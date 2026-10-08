import { HttpStatus, Injectable } from '@nestjs/common';
import { NotificationType, PauseSource, Prisma, type User } from '@prisma/client';
import {
  addDays,
  AttendanceStatus,
  businessNowTime,
  businessToday,
  daysBetween,
  ErrorCode,
  formatShortDate,
  isPauseCutoffPassed,
  MEAL_KEYS,
  MEAL_LABELS,
  NotificationScreen,
  PAUSE_MAX_DAYS,
  pauseOutcomeMessage,
  PauseStatus,
  StudentPauseView,
  StudentStatus,
  type CreatePauseResult,
  type MealType,
  type PauseCalendarDay,
  type StudentPauseSettings,
  type TodayMealState,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { lockStudent } from '../../common/db/student-lock';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, toDateString } from '../../common/http/dates';
import { Paginated, PaginationQueryDto } from '../../common/http/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentsService } from '../students/students.service';
import { studentSearchTerms } from '../students/student-search';
import { CreatePauseDto, ListPausesQueryDto } from './dto/pause.dto';
import { pauseInclude, toPauseRecord, toStudentPauseItem } from './pause.mapper';

interface PauseActor {
  messId: string;
  studentId: string;
  userId: string;
  source: PauseSource;
}


const INCLUDED = { breakfast: 'breakfastIncluded', lunch: 'lunchIncluded', dinner: 'dinnerIncluded' } as const;
const CUTOFF = { breakfast: 'breakfastPauseCutoff', lunch: 'lunchPauseCutoff', dinner: 'dinnerPauseCutoff' } as const;
/** "Nothing to do" outcomes are skipped; everything else is a failure. */
const SKIP_REASONS: ErrorCode[] = [ErrorCode.ATTENDANCE_ALREADY_SERVED, ErrorCode.PAUSE_ALREADY_EXISTS];

const subscriptionSelect = {
  id: true,
  startDate: true,
  endDate: true,
  breakfastIncluded: true,
  lunchIncluded: true,
  dinnerIncluded: true,
} as const;
type CoveringSubscription = Prisma.StudentSubscriptionGetPayload<{ select: typeof subscriptionSelect }>;

/**
 * Meal pauses ("I won't eat this meal on this date"). Pauses never create attendance or touch credits.
 *
 * Eligibility (one place, used by students and by the mess team), checked per date × meal:
 *   subscription covering THAT date → meal included in THAT subscription → not already eaten
 *   → not already paused → same-day cut-off not passed (at the cut-off minute it is blocked).
 */
@Injectable()
export class PausesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Expands the request into date × meal pauses, creating the eligible ones in one locked transaction. */
  async create(actor: PauseActor, dto: CreatePauseDto): Promise<CreatePauseResult> {
    const today = businessToday();
    const span = daysBetween(dto.fromDate, dto.toDate) + 1;
    if (span < 1) throw AppException.validation({ toDate: ['End date must be on or after the start date'] });
    if (span > PAUSE_MAX_DAYS) throw AppException.validation({ toDate: [`Pause at most ${PAUSE_MAX_DAYS} days at a time`] });
    if (dto.fromDate < today) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.PAUSE_DATE_PAST, 'Past days cannot be paused', { fromDate: ['Choose today or a later date'] });
    }

    const from = fromDateString(dto.fromDate);
    const to = fromDateString(dto.toDate);

    const result = await this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, actor.studentId);
      const student = await tx.messStudent.findFirst({
        where: { id: actor.studentId, messId: actor.messId },
        select: { status: true, mess: { select: { breakfastPauseCutoff: true, lunchPauseCutoff: true, dinnerPauseCutoff: true } } },
      });
      if (!student) throw AppException.notFound('Student not found');
      if (student.status !== StudentStatus.ACTIVE) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.STUDENT_NOT_ACTIVE, 'Only active students can pause meals');
      }

      const [subscriptions, served, active] = await Promise.all([
        tx.studentSubscription.findMany({
          where: { studentId: actor.studentId, cancelledAt: null, startDate: { lte: to }, endDate: { gte: from } },
          select: subscriptionSelect,
        }),
        tx.mealAttendance.findMany({
          where: { studentId: actor.studentId, attendanceDate: { gte: from, lte: to }, status: AttendanceStatus.SERVED },
          select: { attendanceDate: true, mealType: true },
        }),
        tx.mealPause.findMany({
          where: { studentId: actor.studentId, pauseDate: { gte: from, lte: to }, status: PauseStatus.ACTIVE },
          select: { pauseDate: true, mealType: true },
        }),
      ]);
      const key = (date: string, meal: MealType) => `${date}|${meal}`;
      const servedSet = new Set(served.map((a) => key(toDateString(a.attendanceDate), a.mealType)));
      const pausedSet = new Set(active.map((p) => key(toDateString(p.pauseDate), p.mealType)));
      const nowTime = businessNowTime();

      const result: CreatePauseResult = { created: [], skipped: [], failed: [] };
      const toCreate: Prisma.MealPauseCreateManyInput[] = [];
      const meals = MEAL_KEYS.filter((m) => dto.mealTypes.includes(m));

      for (let date = dto.fromDate; date <= dto.toDate; date = addDays(date, 1)) {
        // Each date is checked against the subscription valid ON that date (current plan, renewal or plan change).
        const subscription = subscriptions.find((s) => toDateString(s.startDate) <= date && toDateString(s.endDate) >= date);
        for (const meal of meals) {
          const reason = this.ineligibility(subscription, meal, {
            served: servedSet.has(key(date, meal)),
            paused: pausedSet.has(key(date, meal)),
            cutoffPassed: isPauseCutoffPassed(date, student.mess[CUTOFF[meal]], today, nowTime),
          });
          if (reason) {
            const item = { date, mealType: meal, reason, message: pauseOutcomeMessage(reason, meal) };
            (SKIP_REASONS.includes(reason) ? result.skipped : result.failed).push(item);
          } else {
            toCreate.push({
              messId: actor.messId,
              studentId: actor.studentId,
              subscriptionId: subscription!.id,
              pauseDate: fromDateString(date),
              mealType: meal,
              source: actor.source,
              reason: dto.reason ?? null,
              createdById: actor.userId,
            });
          }
        }
      }

      if (toCreate.length) {
        const rows = await tx.mealPause.createManyAndReturn({ data: toCreate, select: { id: true, pauseDate: true, mealType: true } });
        result.created = rows.map((r) => ({ id: r.id, date: toDateString(r.pauseDate), mealType: r.mealType }));
      }
      return result;
    });
    // After commit and best-effort: a notification problem never undoes the pause.
    if (result.created.length) await this.notifyPauses(actor.studentId, actor.messId, result.created, 'created');
    return result;
  }

  /** One summary notification per request (never one per meal/day). */
  private async notifyPauses(studentId: string, messId: string, items: { date: string; mealType: MealType }[], kind: 'created' | 'cancelled') {
    const student = await this.prisma.messStudent.findUnique({ where: { id: studentId }, select: { userId: true } });
    if (!student?.userId) return;
    const meals = MEAL_KEYS.filter((m) => items.some((i) => i.mealType === m)).map((m) => MEAL_LABELS[m]);
    const dates = [...new Set(items.map((i) => i.date))].sort();
    const range = dates.length === 1 ? formatShortDate(dates[0]) : `${formatShortDate(dates[0])} – ${formatShortDate(dates[dates.length - 1])}`;
    const what = items.length === 1 ? meals[0] : `${items.length} meals (${meals.join(', ')})`;
    await this.notifications.notifySafely([{ userId: student.userId, messId }], {
      type: kind === 'created' ? NotificationType.MEAL_PAUSE_CREATED : NotificationType.MEAL_PAUSE_CANCELLED,
      title: kind === 'created' ? `${what} paused` : `${what} pause cancelled`,
      body: kind === 'created' ? `${what} paused for ${range}.` : `${what} pause for ${range} cancelled. You are expected for this meal again.`,
      data: { screen: NotificationScreen.PAUSE },
    });
  }

  /** Cancels an active pause for today or later; the row is kept as history. `studentId` scopes student self-service. */
  async cancel(messId: string, userId: string, id: string, studentId?: string) {
    const target = await this.prisma.mealPause.findFirst({ where: { id, messId, studentId }, select: { studentId: true } });
    if (!target) throw this.notFound();

    await this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, target.studentId);
      const pause = await tx.mealPause.findFirstOrThrow({ where: { id }, select: { status: true, pauseDate: true } });
      if (pause.status === PauseStatus.CANCELLED) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.PAUSE_ALREADY_CANCELLED, 'This pause was already cancelled');
      }
      if (toDateString(pause.pauseDate) < businessToday()) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.PAUSE_DATE_PAST, 'Pauses for past days cannot be changed');
      }
      await tx.mealPause.update({
        where: { id },
        data: { status: PauseStatus.CANCELLED, activeMarker: null, cancelledAt: new Date(), cancelledById: userId },
      });
    });

    const row = await this.prisma.mealPause.findUniqueOrThrow({ where: { id }, include: pauseInclude });
    await this.notifyPauses(row.studentId, messId, [{ date: toDateString(row.pauseDate), mealType: row.mealType }], 'cancelled');
    return toPauseRecord(row, businessToday());
  }

  /** Mess team list. Without dates it shows today onwards. */
  async list(messId: string, query: ListPausesQueryDto) {
    const today = businessToday();
    const where = this.listWhere(messId, query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mealPause.findMany({
        where,
        include: pauseInclude,
        orderBy: [{ pauseDate: 'asc' }, { mealType: 'asc' }, { createdAt: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.mealPause.count({ where }),
    ]);
    return new Paginated(rows.map((r) => toPauseRecord(r, today)), total, query);
  }

  private listWhere(messId: string, query: ListPausesQueryDto): Prisma.MealPauseWhereInput {
    const from = query.from ?? (query.to ? undefined : businessToday());
    return {
      messId,
      studentId: query.studentId,
      mealType: query.mealType,
      status: query.status,
      pauseDate: { ...(from ? { gte: fromDateString(from) } : {}), ...(query.to ? { lte: fromDateString(query.to) } : {}) },
      ...(query.search ? { student: { AND: studentSearchTerms(query.search) } } : {}),
    };
  }

  /** Active vs cancelled pauses per meal for the filtered set. */
  async listSummary(messId: string, query: ListPausesQueryDto) {
    const groups = await this.prisma.mealPause.groupBy({ by: ['mealType', 'status'], where: this.listWhere(messId, query), _count: { _all: true } });
    const count = (meal: MealType, status: PauseStatus) => groups.find((g) => g.mealType === meal && g.status === status)?._count._all ?? 0;
    const active = Object.fromEntries(MEAL_KEYS.map((m) => [m, count(m, PauseStatus.ACTIVE)])) as Record<MealType, number>;
    const cancelled = MEAL_KEYS.reduce((sum, m) => sum + count(m, PauseStatus.CANCELLED), 0);
    return { active, activeTotal: active.breakfast + active.lunch + active.dinner, cancelled };
  }

  /** Active paused meals per day (one grouped query). */
  async calendar(messId: string, from: string, to: string): Promise<PauseCalendarDay[]> {
    const span = daysBetween(from, to) + 1;
    if (span < 1 || span > PAUSE_MAX_DAYS) throw AppException.validation({ to: [`Choose 1 to ${PAUSE_MAX_DAYS} days`] });
    const groups = await this.prisma.mealPause.groupBy({
      by: ['pauseDate', 'mealType'],
      where: { messId, status: PauseStatus.ACTIVE, pauseDate: { gte: fromDateString(from), lte: fromDateString(to) } },
      _count: { _all: true },
    });
    const days: PauseCalendarDay[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const count = (meal: MealType) => groups.find((g) => toDateString(g.pauseDate) === date && g.mealType === meal)?._count._all ?? 0;
      days.push({ date, breakfast: count('breakfast'), lunch: count('lunch'), dinner: count('dinner') });
    }
    return days;
  }

  // ── Student self-service ──

  async createForSelf(user: User, dto: CreatePauseDto) {
    const student = await this.requireSelf(user);
    return this.create({ messId: student.messId, studentId: student.id, userId: user.id, source: PauseSource.STUDENT }, dto);
  }

  async cancelForSelf(user: User, id: string) {
    const student = await this.students.resolveSelf(user);
    if (!student) throw this.notFound();
    const { student: _student, createdBy: _c, cancelledBy: _x, ...item } = await this.cancel(student.messId, user.id, id, student.id);
    return item;
  }

  async listForSelf(user: User, view: StudentPauseView = StudentPauseView.UPCOMING, query: PaginationQueryDto) {
    const student = await this.students.resolveSelf(user);
    if (!student) return new Paginated([], 0, query);
    const today = fromDateString(businessToday());
    const where: Prisma.MealPauseWhereInput = {
      studentId: student.id,
      ...(view === StudentPauseView.CANCELLED
        ? { status: PauseStatus.CANCELLED }
        : { status: PauseStatus.ACTIVE, pauseDate: view === StudentPauseView.UPCOMING ? { gte: today } : { lt: today } }),
    };
    const asc = view === StudentPauseView.UPCOMING;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.mealPause.findMany({
        where,
        orderBy: [{ pauseDate: asc ? 'asc' : 'desc' }, { mealType: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.mealPause.count({ where }),
    ]);
    return new Paginated(rows.map((r) => toStudentPauseItem(r, businessToday())), total, query);
  }

  /** Everything the pause screen needs: cut-offs, plans by date and today's meal states. */
  async settingsForSelf(user: User): Promise<StudentPauseSettings> {
    const student = await this.students.resolveSelf(user);
    if (!student) return { linked: false };
    const today = businessToday();
    const day = fromDateString(today);
    const [mess, plans, served, paused] = await Promise.all([
      this.prisma.mess.findUniqueOrThrow({
        where: { id: student.messId },
        select: {
          name: true,
          breakfastAvailable: true,
          lunchAvailable: true,
          dinnerAvailable: true,
          breakfastPauseCutoff: true,
          lunchPauseCutoff: true,
          dinnerPauseCutoff: true,
        },
      }),
      this.prisma.studentSubscription.findMany({
        where: { studentId: student.id, cancelledAt: null, endDate: { gte: day } },
        select: subscriptionSelect,
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.mealAttendance.findMany({ where: { studentId: student.id, attendanceDate: day, status: AttendanceStatus.SERVED }, select: { mealType: true } }),
      this.prisma.mealPause.findMany({ where: { studentId: student.id, pauseDate: day, status: PauseStatus.ACTIVE }, select: { mealType: true } }),
    ]);
    const current = plans.find((p) => toDateString(p.startDate) <= today);
    const state = (meal: MealType): TodayMealState =>
      !current?.[INCLUDED[meal]]
        ? 'NOT_INCLUDED'
        : served.some((s) => s.mealType === meal)
          ? 'SERVED'
          : paused.some((p) => p.mealType === meal)
            ? 'PAUSED'
            : 'AVAILABLE';

    return {
      linked: true,
      messName: mess.name,
      today,
      nowTime: businessNowTime(),
      cutoffs: { breakfast: mess.breakfastPauseCutoff, lunch: mess.lunchPauseCutoff, dinner: mess.dinnerPauseCutoff },
      servedMeals: { breakfast: mess.breakfastAvailable, lunch: mess.lunchAvailable, dinner: mess.dinnerAvailable },
      studentActive: student.status === StudentStatus.ACTIVE,
      plans: plans.map((p) => ({
        startDate: toDateString(p.startDate),
        endDate: toDateString(p.endDate),
        meals: { breakfast: p.breakfastIncluded, lunch: p.lunchIncluded, dinner: p.dinnerIncluded },
      })),
      todayMeals: { breakfast: state('breakfast'), lunch: state('lunch'), dinner: state('dinner') },
    };
  }

  private ineligibility(
    subscription: CoveringSubscription | undefined,
    meal: MealType,
    flags: { served: boolean; paused: boolean; cutoffPassed: boolean },
  ): ErrorCode | null {
    if (!subscription) return ErrorCode.NO_ACTIVE_SUBSCRIPTION;
    if (!subscription[INCLUDED[meal]]) return ErrorCode.MEAL_NOT_INCLUDED;
    if (flags.served) return ErrorCode.ATTENDANCE_ALREADY_SERVED;
    if (flags.paused) return ErrorCode.PAUSE_ALREADY_EXISTS;
    if (flags.cutoffPassed) return ErrorCode.PAUSE_CUTOFF_PASSED;
    return null;
  }

  private async requireSelf(user: User) {
    const student = await this.students.resolveSelf(user);
    if (!student) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.STUDENT_NOT_LINKED, 'Your mess has not linked your mobile number yet');
    }
    return student;
  }

  private notFound() {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.PAUSE_NOT_FOUND, 'Pause not found');
  }
}
