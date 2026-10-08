import { HttpStatus, Injectable } from '@nestjs/common';
import { AttendanceSource, Prisma, type User } from '@prisma/client';
import {
  AttendanceStatus,
  businessToday,
  ErrorCode,
  MEAL_KEYS,
  PauseStatus,
  serveRejectionMessage,
  StudentStatus,
  SubscriptionStatus,
  type AttendanceStudent,
  type AttendanceSummary,
  type MealQrResponse,
  type MealType,
  type ServeResult,
  type StudentAttendanceItem,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { lockStudent } from '../../common/db/student-lock';
import { AppException } from '../../common/http/app.exception';
import { fromDateString } from '../../common/http/dates';
import { Paginated, PaginationQueryDto } from '../../common/http/pagination';
import { StudentsService } from '../students/students.service';
import { studentSearchTerms } from '../students/student-search';
import { statusWhere } from '../subscriptions/subscription.rules';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ListAttendanceQueryDto, ManualAttendanceDto, ScanDto } from './dto/attendance.dto';
import { attendanceInclude, toAttendanceRecord, toStudentAttendanceItem } from './attendance.mapper';
import { MealQrService } from './meal-qr.service';

interface Actor {
  messId: string;
  userId: string;
}

const INCLUDED: Record<MealType, 'breakfastIncluded' | 'lunchIncluded' | 'dinnerIncluded'> = {
  breakfast: 'breakfastIncluded',
  lunch: 'lunchIncluded',
  dinner: 'dinnerIncluded',
};

/** Thrown inside the transaction to roll back, then turned into a normal rejection. */
class ServeRejection extends Error {
  constructor(readonly reason: ErrorCode) {
    super(reason);
  }
}

/**
 * Meal attendance. All serving (QR and manual) goes through `serve()`, which runs the full rule chain
 * inside one transaction holding the student's lock:
 *   student in this mess → student active → subscription valid today → meal included → meal not paused
 *   → not already served → (limited plan) one credit consumed → attendance created.
 * A rejection never writes anything. The unique key on meal_attendance backs up the duplicate check.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: MealQrService,
    private readonly students: StudentsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async scan(actor: Actor, dto: ScanDto): Promise<ServeResult> {
    const verified = this.qr.verify(dto.qrToken);
    if (!verified.ok) return this.reject(verified.reason, dto.mealType);
    // A QR issued for another mess is treated exactly like an unknown student.
    if (verified.messId !== actor.messId) return this.reject(ErrorCode.STUDENT_NOT_FOUND, dto.mealType);
    return this.serve(actor, verified.studentId, dto.mealType, AttendanceSource.QR);
  }

  async manual(actor: Actor, dto: ManualAttendanceDto): Promise<ServeResult> {
    const result = await this.serve(actor, dto.studentId, dto.mealType, AttendanceSource.MANUAL, dto.note);
    if (result.outcome === 'REJECTED' && result.reason === ErrorCode.STUDENT_NOT_FOUND) throw AppException.notFound('Student not found');
    return result;
  }

  async list(messId: string, query: ListAttendanceQueryDto): Promise<Paginated<ReturnType<typeof toAttendanceRecord>>> {
    const where: Prisma.MealAttendanceWhereInput = {
      messId,
      attendanceDate: fromDateString(query.date ?? businessToday()),
      mealType: query.mealType,
      status: query.status,
      ...(query.search ? { student: { AND: studentSearchTerms(query.search) } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mealAttendance.findMany({
        where,
        include: attendanceInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.mealAttendance.count({ where }),
    ]);
    return new Paginated(rows.map(toAttendanceRecord), total, query);
  }

  /** Served meals per meal type for a date (reversed ones excluded). */
  async summary(messId: string, date = businessToday()): Promise<AttendanceSummary> {
    const groups = await this.prisma.mealAttendance.groupBy({
      by: ['mealType'],
      where: { messId, attendanceDate: fromDateString(date), status: AttendanceStatus.SERVED },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(MEAL_KEYS.map((k) => [k, groups.find((g) => g.mealType === k)?._count._all ?? 0])) as Record<MealType, number>;
    return { date, ...counts, total: counts.breakfast + counts.lunch + counts.dinner };
  }

  /** Marks a served meal as reversed (row kept) and gives back the credit if it used one. */
  async reverse(actor: Actor, id: string, reason?: string) {
    const target = await this.prisma.mealAttendance.findFirst({ where: { id, messId: actor.messId }, select: { studentId: true } });
    if (!target) throw this.notFound();

    await this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, target.studentId);
      const row = await tx.mealAttendance.findFirst({
        where: { id, messId: actor.messId },
        select: { status: true, creditDeducted: true, subscriptionId: true },
      });
      if (!row) throw this.notFound();
      if (row.status === AttendanceStatus.REVERSED) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.ATTENDANCE_ALREADY_REVERSED, 'This meal was already reversed');
      }
      await tx.mealAttendance.update({
        where: { id },
        data: {
          status: AttendanceStatus.REVERSED,
          servedMarker: null,
          reversedAt: new Date(),
          reversedById: actor.userId,
          reversalReason: reason ?? null,
        },
      });
      if (row.creditDeducted) await this.subscriptions.restoreMealCredit(row.subscriptionId, tx);
    });

    const updated = await this.prisma.mealAttendance.findUniqueOrThrow({ where: { id }, include: attendanceInclude });
    return toAttendanceRecord(updated);
  }

  // ── Student self-service ──

  /** A fresh signed QR, only when the student can actually be served today. */
  async mealQr(user: User): Promise<MealQrResponse> {
    const student = await this.students.resolveSelf(user);
    if (!student) return { state: 'NOT_LINKED' };
    if (student.status !== StudentStatus.ACTIVE) return { state: 'INACTIVE', messName: student.mess.name };

    const today = businessToday();
    const studentName = [student.firstName, student.lastName].filter(Boolean).join(' ');
    const [subscription, served, paused] = await Promise.all([
      this.currentSubscription(this.prisma, student.id, today),
      this.prisma.mealAttendance.findMany({
        where: { studentId: student.id, attendanceDate: fromDateString(today), status: AttendanceStatus.SERVED },
        select: { mealType: true },
      }),
      this.prisma.mealPause.findMany({
        where: { studentId: student.id, pauseDate: fromDateString(today), status: PauseStatus.ACTIVE },
        select: { mealType: true },
      }),
    ]);
    if (!subscription) return { state: 'NO_PLAN', messName: student.mess.name, studentName };

    const { token, expiresAt, expiresIn } = this.qr.issue(student);
    return {
      state: 'READY',
      token,
      expiresAt: expiresAt.toISOString(),
      expiresIn,
      studentName,
      messName: student.mess.name,
      planName: subscription.planName,
      meals: { breakfast: subscription.breakfastIncluded, lunch: subscription.lunchIncluded, dinner: subscription.dinnerIncluded },
      servedToday: served.map((s) => s.mealType),
      pausedToday: paused.map((p) => p.mealType),
    };
  }

  async studentHistory(user: User, query: PaginationQueryDto): Promise<Paginated<StudentAttendanceItem>> {
    const student = await this.students.resolveSelf(user);
    if (!student) return new Paginated([], 0, query);
    const where = { studentId: student.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mealAttendance.findMany({
        where,
        include: { subscription: { select: { planName: true } } },
        orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.mealAttendance.count({ where }),
    ]);
    return new Paginated(rows.map(toStudentAttendanceItem), total, query);
  }

  // ── Core rule chain ──

  private async serve(actor: Actor, studentId: string, mealType: MealType, source: AttendanceSource, note?: string): Promise<ServeResult> {
    const today = businessToday();
    let identified: { student: AttendanceStudent | null; planName: string | null } = { student: null, planName: null };

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        await lockStudent(tx, studentId);
        const student = await tx.messStudent.findFirst({
          where: { id: studentId, messId: actor.messId },
          select: { id: true, firstName: true, lastName: true, mobile: true, status: true },
        });
        if (!student) throw new ServeRejection(ErrorCode.STUDENT_NOT_FOUND);
        const { status, ...summary } = student;
        identified = { student: summary, planName: null };
        if (status !== StudentStatus.ACTIVE) throw new ServeRejection(ErrorCode.STUDENT_NOT_ACTIVE);

        // Only the subscription valid today counts; an upcoming renewal is never used early.
        const subscription = await this.currentSubscription(tx, student.id, today);
        if (!subscription) throw new ServeRejection(ErrorCode.NO_ACTIVE_SUBSCRIPTION);
        identified.planName = subscription.planName;
        if (!subscription[INCLUDED[mealType]]) throw new ServeRejection(ErrorCode.MEAL_NOT_INCLUDED);

        // An active pause means the student said they won't eat this meal; they must cancel it first.
        const paused = await tx.mealPause.count({
          where: { studentId: student.id, pauseDate: fromDateString(today), mealType, status: PauseStatus.ACTIVE },
        });
        if (paused) throw new ServeRejection(ErrorCode.MEAL_PAUSED);

        const alreadyServed = await tx.mealAttendance.count({
          where: { studentId: student.id, attendanceDate: fromDateString(today), mealType, status: AttendanceStatus.SERVED },
        });
        if (alreadyServed) throw new ServeRejection(ErrorCode.ALREADY_SERVED);

        const limited = subscription.totalMealCredits !== null;
        if (limited && !(await this.subscriptions.consumeMealCredit(subscription.id, tx))) {
          throw new ServeRejection(ErrorCode.NO_MEAL_CREDITS);
        }

        const created = await tx.mealAttendance.create({
          data: {
            messId: actor.messId,
            studentId: student.id,
            subscriptionId: subscription.id,
            attendanceDate: fromDateString(today),
            mealType,
            source,
            creditDeducted: limited,
            servedById: actor.userId,
            note: note ?? null,
          },
          select: { id: true },
        });
        return created.id;
      });

      const row = await this.prisma.mealAttendance.findUniqueOrThrow({ where: { id }, include: attendanceInclude });
      return { outcome: 'SERVED', attendance: toAttendanceRecord(row) };
    } catch (error) {
      if (error instanceof ServeRejection) return this.reject(error.reason, mealType, identified.student, identified.planName);
      // Unique key backstop: a concurrent writer that bypassed the lock still can't double-serve.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.reject(ErrorCode.ALREADY_SERVED, mealType, identified.student, identified.planName);
      }
      throw error;
    }
  }

  private currentSubscription(db: Prisma.TransactionClient, studentId: string, today: string) {
    return db.studentSubscription.findFirst({
      where: { studentId, ...statusWhere(SubscriptionStatus.ACTIVE, today) },
      select: {
        id: true,
        planName: true,
        breakfastIncluded: true,
        lunchIncluded: true,
        dinnerIncluded: true,
        totalMealCredits: true,
      },
    });
  }

  private reject(reason: ErrorCode, mealType: MealType, student: AttendanceStudent | null = null, planName: string | null = null): ServeResult {
    return { outcome: 'REJECTED', reason, message: serveRejectionMessage(reason, mealType), mealType, student, planName };
  }

  private notFound() {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.ATTENDANCE_NOT_FOUND, 'Attendance record not found');
  }
}
