import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import {
  addDays,
  businessToday,
  ErrorCode,
  formatPaise,
  PAYMENT_LIMITS,
  paymentSummary,
  PaymentTransactionStatus,
  StudentStatus,
  SubscriptionPaymentStatus,
  subscriptionStatus,
  type DueItem,
  type MonthlyPaymentStatus,
  type PaymentDashboardSummary,
  type PaymentRecord,
  type StudentFeesResponse,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { lockStudent } from '../../common/db/student-lock';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, toDateString } from '../../common/http/dates';
import { Paginated, PaginationQueryDto } from '../../common/http/pagination';
import { StudentsService } from '../students/students.service';
import { studentSearchTerms } from '../students/student-search';
import { statusWhere } from '../subscriptions/subscription.rules';
import { toSubscriptionSummary } from '../subscriptions/subscription.mapper';
import { DuesQueryDto, ListPaymentsQueryDto, MonthlyStatusQueryDto, RecordPaymentDto } from './dto/payment.dto';
import { paymentInclude, toPaymentReceipt, toPaymentRecord } from './payment.mapper';

const studentSelect = { id: true, firstName: true, lastName: true, mobile: true } as const;
const messReceiptSelect = { name: true, mobile: true, address: true, city: true } as const;

/**
 * Manual payment tracking. Each payment belongs to exactly one subscription (no automatic allocation).
 * The subscription's `amountPaidPaise` is the running total of RECORDED payments and is only changed here,
 * inside the student lock, together with the payment row. Fee = plan price snapshot; due = fee − paid.
 * Payments never touch attendance, pauses, credits or plan dates.
 */
@Injectable()
export class PaymentsService {
  private readonly priceRef: Prisma.FieldRef<'StudentSubscription', 'Int'>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {
    this.priceRef = prisma.studentSubscription.fields.planPricePaise;
  }

  async record(messId: string, userId: string, dto: RecordPaymentDto): Promise<PaymentRecord> {
    // A retried submit with the same key returns the original payment.
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { messId_idempotencyKey: { messId, idempotencyKey: dto.idempotencyKey } },
        include: paymentInclude,
      });
      if (existing) return toPaymentRecord(existing);
    }

    const today = businessToday();
    const paymentDate = dto.paymentDate ?? today;
    if (paymentDate > today) throw AppException.validation({ paymentDate: ['Payment date cannot be in the future'] });
    if (paymentDate < addDays(today, -PAYMENT_LIMITS.backdateDays)) throw AppException.validation({ paymentDate: ['Payment date is too far in the past'] });

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        await lockStudent(tx, dto.studentId);
        const subscription = await tx.studentSubscription.findFirst({
          where: { id: dto.subscriptionId, studentId: dto.studentId, messId },
          select: { planPricePaise: true, amountPaidPaise: true, cancelledAt: true, student: { select: { status: true } } },
        });
        if (!subscription) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.SUBSCRIPTION_NOT_FOUND, 'Subscription not found for this student');
        if (subscription.cancelledAt) {
          throw new AppException(HttpStatus.CONFLICT, ErrorCode.SUBSCRIPTION_CANCELLED, 'This subscription was cancelled; new payments cannot be added to it');
        }
        if (subscription.student.status === StudentStatus.ARCHIVED) {
          throw new AppException(HttpStatus.CONFLICT, ErrorCode.STUDENT_NOT_ACTIVE, 'This student is archived. Restore them before recording a payment.');
        }
        const due = subscription.planPricePaise - subscription.amountPaidPaise;
        if (due <= 0) throw new AppException(HttpStatus.CONFLICT, ErrorCode.NO_OUTSTANDING_BALANCE, 'This subscription is already fully paid');
        if (dto.amountPaise > due) {
          throw new AppException(HttpStatus.CONFLICT, ErrorCode.PAYMENT_EXCEEDS_BALANCE, `Amount is more than the balance due (${formatPaise(due)})`, {
            amountPaise: [`At most ${formatPaise(due)}`],
          });
        }

        const [{ receiptSequence }] = await tx.$queryRaw<{ receiptSequence: number }[]>`
          UPDATE messes SET "receiptSequence" = "receiptSequence" + 1 WHERE id = ${messId}::uuid RETURNING "receiptSequence"`;
        const receiptNumber = `RCPT-${today.slice(0, 4)}-${String(receiptSequence).padStart(6, '0')}`;

        const payment = await tx.payment.create({
          data: {
            messId,
            studentId: dto.studentId,
            subscriptionId: dto.subscriptionId,
            receiptNumber,
            amountPaise: dto.amountPaise,
            method: dto.method,
            paymentDate: fromDateString(paymentDate),
            referenceNumber: dto.referenceNumber ?? null,
            note: dto.note ?? null,
            balanceAfterPaise: due - dto.amountPaise,
            idempotencyKey: dto.idempotencyKey ?? null,
            recordedById: userId,
          },
          select: { id: true },
        });
        await tx.studentSubscription.update({
          where: { id: dto.subscriptionId },
          data: { amountPaidPaise: { increment: dto.amountPaise } },
        });
        return payment.id;
      });
      return this.getRecord(messId, id);
    } catch (error) {
      // Two simultaneous submits with the same key: the loser returns the winner's payment.
      if (dto.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.payment.findUnique({
          where: { messId_idempotencyKey: { messId, idempotencyKey: dto.idempotencyKey } },
          include: paymentInclude,
        });
        if (existing) return toPaymentRecord(existing);
      }
      throw error;
    }
  }

  /** Marks a payment reversed (row kept) and gives the amount back to the balance due. */
  async reverse(messId: string, userId: string, id: string, reason?: string): Promise<PaymentRecord> {
    const target = await this.prisma.payment.findFirst({ where: { id, messId }, select: { studentId: true } });
    if (!target) throw this.notFound();
    await this.prisma.$transaction(async (tx) => {
      await lockStudent(tx, target.studentId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id }, select: { status: true, amountPaise: true, subscriptionId: true } });
      if (payment.status === PaymentTransactionStatus.REVERSED) {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.PAYMENT_ALREADY_REVERSED, 'This payment was already reversed');
      }
      await tx.payment.update({
        where: { id },
        data: { status: PaymentTransactionStatus.REVERSED, reversedAt: new Date(), reversedById: userId, reversalReason: reason ?? null },
      });
      await tx.studentSubscription.update({
        where: { id: payment.subscriptionId },
        data: { amountPaidPaise: { decrement: payment.amountPaise } },
      });
    });
    return this.getRecord(messId, id);
  }

  async list(messId: string, query: ListPaymentsQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      messId,
      method: query.method,
      status: query.status,
      studentId: query.studentId,
      subscriptionId: query.subscriptionId,
      paymentDate: { ...(query.from ? { gte: fromDateString(query.from) } : {}), ...(query.to ? { lte: fromDateString(query.to) } : {}) },
      ...(query.search ? { student: { AND: studentSearchTerms(query.search) } } : {}),
    };
    const order = query.sortOrder ?? 'desc';
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: query.sortBy === 'amount' ? [{ amountPaise: order }, { createdAt: 'desc' }] : [{ paymentDate: order }, { createdAt: order }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return new Paginated(rows.map(toPaymentRecord), total, query);
  }

  async getRecord(messId: string, id: string): Promise<PaymentRecord> {
    const row = await this.prisma.payment.findFirst({ where: { id, messId }, include: paymentInclude });
    if (!row) throw this.notFound();
    return toPaymentRecord(row);
  }

  async receipt(messId: string, id: string, studentId?: string) {
    const row = await this.prisma.payment.findFirst({
      where: { id, messId, studentId },
      include: { ...paymentInclude, mess: { select: messReceiptSelect } },
    });
    if (!row) throw this.notFound();
    return toPaymentReceipt(row);
  }

  /** Non-cancelled subscriptions with money still due (field-to-field comparison runs in SQL). */
  async dues(messId: string, query: DuesQueryDto) {
    const where: Prisma.StudentSubscriptionWhereInput = {
      messId,
      cancelledAt: null,
      amountPaidPaise: { lt: this.priceRef },
      studentId: query.studentId,
      student: { status: { not: StudentStatus.ARCHIVED }, ...(query.search ? { AND: studentSearchTerms(query.search) } : {}) },
      ...(query.subscriptionStatus ? statusWhere(query.subscriptionStatus, businessToday()) : {}),
    };
    return this.dueItems(where, query, [{ endDate: 'asc' }, { id: 'asc' }]);
  }

  /**
   * "Monthly payment status": subscriptions whose dates overlap the month, with their paid/partial/unpaid state.
   * Not an invoice — a subscription spanning two months appears in both months.
   */
  async monthlySummary(messId: string, month: string): Promise<MonthlyPaymentStatus> {
    const { start, end } = this.monthRange(month);
    const [totals] = await this.prisma.$queryRaw<{ paid: number; partial: number; unpaid: number; expected: bigint | null; collected: bigint | null }[]>`
      SELECT
        count(*) FILTER (WHERE "amountPaidPaise" >= "planPricePaise")::int AS paid,
        count(*) FILTER (WHERE "amountPaidPaise" > 0 AND "amountPaidPaise" < "planPricePaise")::int AS partial,
        count(*) FILTER (WHERE "amountPaidPaise" = 0 AND "planPricePaise" > 0)::int AS unpaid,
        sum("planPricePaise") AS expected,
        sum("amountPaidPaise") AS collected
      FROM student_subscriptions
      WHERE "messId" = ${messId}::uuid AND "cancelledAt" IS NULL
        AND "startDate" <= ${end}::date AND "endDate" >= ${start}::date`;
    const expectedPaise = Number(totals.expected ?? 0);
    const collectedPaise = Number(totals.collected ?? 0);
    return {
      month,
      counts: { PAID: totals.paid, PARTIAL: totals.partial, UNPAID: totals.unpaid },
      expectedPaise,
      collectedPaise,
      pendingPaise: expectedPaise - collectedPaise,
    };
  }

  async monthlyList(messId: string, query: MonthlyStatusQueryDto) {
    const { start, end } = this.monthRange(query.month);
    const statusFilter: Record<SubscriptionPaymentStatus, Prisma.StudentSubscriptionWhereInput> = {
      PAID: { amountPaidPaise: { gte: this.priceRef } },
      PARTIAL: { amountPaidPaise: { gt: 0, lt: this.priceRef } },
      UNPAID: { amountPaidPaise: 0, planPricePaise: { gt: 0 } },
    };
    return this.dueItems(
      {
        messId,
        cancelledAt: null,
        startDate: { lte: fromDateString(end) },
        endDate: { gte: fromDateString(start) },
        ...(query.paymentStatus ? statusFilter[query.paymentStatus] : {}),
        ...(query.search ? { student: { AND: studentSearchTerms(query.search) } } : {}),
      },
      query,
      [{ student: { firstName: 'asc' } }, { startDate: 'asc' }, { id: 'asc' }],
    );
  }

  async dashboard(messId: string): Promise<PaymentDashboardSummary> {
    const today = businessToday();
    const monthStart = `${today.slice(0, 7)}-01`;
    const recorded = { messId, status: PaymentTransactionStatus.RECORDED };
    const [todaySum, monthSum, [dues]] = await Promise.all([
      this.prisma.payment.aggregate({ where: { ...recorded, paymentDate: fromDateString(today) }, _sum: { amountPaise: true } }),
      this.prisma.payment.aggregate({
        where: { ...recorded, paymentDate: { gte: fromDateString(monthStart), lte: fromDateString(today) } },
        _sum: { amountPaise: true },
      }),
      this.prisma.$queryRaw<{ pending: bigint | null; students: number }[]>`
        SELECT sum(s."planPricePaise" - s."amountPaidPaise") AS pending, count(DISTINCT s."studentId")::int AS students
        FROM student_subscriptions s JOIN mess_students st ON st.id = s."studentId"
        WHERE s."messId" = ${messId}::uuid AND s."cancelledAt" IS NULL
          AND s."amountPaidPaise" < s."planPricePaise" AND st.status <> 'ARCHIVED'`,
    ]);
    return {
      collectedTodayPaise: todaySum._sum.amountPaise ?? 0,
      collectedThisMonthPaise: monthSum._sum.amountPaise ?? 0,
      pendingDuesPaise: Number(dues.pending ?? 0),
      studentsWithDues: dues.students,
    };
  }

  // ── Student self-service ──

  /** Current/upcoming subscriptions plus any older ones still owing money. */
  async feesForSelf(user: User): Promise<StudentFeesResponse> {
    const student = await this.students.resolveSelf(user);
    if (!student) return { linked: false };
    const today = businessToday();
    const rows = await this.prisma.studentSubscription.findMany({
      where: {
        studentId: student.id,
        cancelledAt: null,
        OR: [{ endDate: { gte: fromDateString(today) } }, { amountPaidPaise: { lt: this.priceRef } }],
      },
      orderBy: { startDate: 'asc' },
    });
    const subscriptions = rows.map((r) => toSubscriptionSummary(r, today));
    return {
      linked: true,
      messName: student.mess.name,
      totalDuePaise: subscriptions.reduce((sum, s) => sum + s.payment.duePaise, 0),
      subscriptions,
    };
  }

  async listForSelf(user: User, query: PaginationQueryDto) {
    const student = await this.students.resolveSelf(user);
    if (!student) return new Paginated([], 0, query);
    const where = { studentId: student.id, messId: student.messId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, include: paymentInclude, orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }], skip: query.skip, take: query.pageSize }),
      this.prisma.payment.count({ where }),
    ]);
    return new Paginated(rows.map(toPaymentRecord), total, query);
  }

  async receiptForSelf(user: User, id: string) {
    const student = await this.students.resolveSelf(user);
    if (!student) throw this.notFound();
    return this.receipt(student.messId, id, student.id);
  }

  private monthRange(month: string) {
    const [y, m] = month.split('-').map(Number);
    return { start: `${month}-01`, end: toDateString(new Date(Date.UTC(y, m, 0))) };
  }

  private async dueItems(
    where: Prisma.StudentSubscriptionWhereInput,
    query: PaginationQueryDto,
    orderBy: Prisma.StudentSubscriptionOrderByWithRelationInput[],
  ) {
    const today = businessToday();
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.studentSubscription.findMany({
        where,
        include: { student: { select: studentSelect } },
        orderBy,
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.studentSubscription.count({ where }),
    ]);
    const items: DueItem[] = rows.map((r) => {
      const startDate = toDateString(r.startDate);
      const endDate = toDateString(r.endDate);
      return {
        subscriptionId: r.id,
        student: r.student,
        planName: r.planName,
        startDate,
        endDate,
        subscriptionStatus: subscriptionStatus({ startDate, endDate, cancelledAt: null }, today),
        payment: paymentSummary(r.planPricePaise, r.amountPaidPaise),
      };
    });
    return new Paginated(items, total, query);
  }

  private notFound() {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.PAYMENT_NOT_FOUND, 'Payment not found');
  }
}
