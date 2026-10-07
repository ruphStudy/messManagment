import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import {
  addDays,
  businessToday,
  calculateEndDate,
  ErrorCode,
  normalizeMobile,
  PlanChangeMode,
  StudentStatus,
  SubscriptionKind,
  SubscriptionStatus,
  subscriptionStatus,
  type MySubscriptionResponse,
  type SubscriptionDetail,
  type SubscriptionListItem,
  type SubscriptionSummary,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, toDateString } from '../../common/http/dates';
import { Paginated, PaginationQueryDto } from '../../common/http/pagination';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { StudentsService } from '../students/students.service';
import { AssignSubscriptionDto, ChangePlanDto, ListSubscriptionsQueryDto, RenewSubscriptionDto } from './dto/subscription.dto';
import { expiringSoonWhere, overlapWhere, statusWhere } from './subscription.rules';
import {
  studentSummarySelect,
  toSubscriptionDetail,
  toSubscriptionListItem,
  toSubscriptionSummary,
} from './subscription.mapper';

type Tx = Prisma.TransactionClient;

interface NewTerm {
  messId: string;
  studentId: string;
  mealPlanId: string;
  startDate: string;
  endDate?: string;
  kind: SubscriptionKind;
}

const listInclude = { student: { select: studentSummarySelect } } as const;
const detailInclude = { ...listInclude, mealPlan: { select: { id: true, name: true, status: true } } } as const;

/**
 * Student subscriptions. Rules (MVP):
 * - A student can never have two non-cancelled subscriptions covering the same day
 *   (so at most one ACTIVE, plus any number of UPCOMING lined up after it).
 * - Only ACTIVE students can receive new subscriptions, from ACTIVE plans of the same mess.
 * - Renewals and plan changes always create a new record; old records are never rewritten into a new term.
 * - Every query is scoped by the caller's messId.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: MealPlansService,
    private readonly students: StudentsService,
  ) {}

  async list(messId: string, query: ListSubscriptionsQueryDto): Promise<Paginated<SubscriptionListItem>> {
    const today = businessToday();
    const where: Prisma.StudentSubscriptionWhereInput = {
      messId,
      mealPlanId: query.mealPlanId,
      studentId: query.studentId,
      ...(query.expiringSoon ? expiringSoonWhere(today) : query.status ? statusWhere(query.status, today) : {}),
      ...(query.search ? { student: { AND: this.studentSearch(query.search) } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.studentSubscription.findMany({
        where,
        include: listInclude,
        orderBy: this.orderBy(query),
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.studentSubscription.count({ where }),
    ]);
    return new Paginated(rows.map((r) => toSubscriptionListItem(r, today)), total, query);
  }

  async get(messId: string, id: string): Promise<SubscriptionDetail> {
    const row = await this.prisma.studentSubscription.findFirst({ where: { id, messId }, include: detailInclude });
    if (!row) throw this.notFound();
    return toSubscriptionDetail(row, businessToday());
  }

  /** Full history of one student of this mess, newest first. */
  async listForStudent(messId: string, studentId: string): Promise<SubscriptionSummary[]> {
    const student = await this.prisma.messStudent.count({ where: { id: studentId, messId } });
    if (!student) throw AppException.notFound('Student not found');
    const today = businessToday();
    const rows = await this.prisma.studentSubscription.findMany({
      where: { messId, studentId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return rows.map((r) => toSubscriptionSummary(r, today));
  }

  assign(messId: string, studentId: string, dto: AssignSubscriptionDto): Promise<SubscriptionDetail> {
    return this.inStudentLock(studentId, (tx) => this.createTerm(tx, { ...dto, messId, studentId, kind: SubscriptionKind.NEW }));
  }

  /** New term of the same (or another) plan, by default starting the day after the current one ends. */
  async renew(messId: string, id: string, dto: RenewSubscriptionDto): Promise<SubscriptionDetail> {
    const current = await this.findOwned(messId, id);
    if (current.cancelledAt) throw this.notChangeable('A cancelled subscription cannot be renewed. Assign a new plan instead.');
    const mealPlanId = dto.mealPlanId ?? current.mealPlanId;
    if (!mealPlanId) throw AppException.validation({ mealPlanId: ['Select a meal plan'] });

    const today = businessToday();
    const dayAfter = addDays(toDateString(current.endDate), 1);
    const startDate = dto.startDate ?? (dayAfter > today ? dayAfter : today);
    return this.inStudentLock(current.studentId, (tx) =>
      this.createTerm(tx, { messId, studentId: current.studentId, mealPlanId, startDate, endDate: dto.endDate, kind: SubscriptionKind.RENEWAL }),
    );
  }

  /**
   * AFTER_CURRENT: the new plan starts the day after this subscription ends.
   * IMMEDIATE: this subscription is cancelled and the new plan starts today (no proration).
   */
  async changePlan(messId: string, id: string, dto: ChangePlanDto, canCancel: boolean): Promise<SubscriptionDetail> {
    const current = await this.findOwned(messId, id);
    const today = businessToday();
    const status = subscriptionStatus(
      { startDate: toDateString(current.startDate), endDate: toDateString(current.endDate), cancelledAt: current.cancelledAt },
      today,
    );
    if (status !== SubscriptionStatus.ACTIVE && status !== SubscriptionStatus.UPCOMING) {
      throw this.notChangeable('Only active or upcoming subscriptions can be changed. Assign a new plan instead.');
    }
    if (dto.mealPlanId === current.mealPlanId) throw AppException.validation({ mealPlanId: ['Choose a different plan'] });

    const term = { messId, studentId: current.studentId, mealPlanId: dto.mealPlanId, kind: SubscriptionKind.PLAN_CHANGE };
    if (dto.mode === PlanChangeMode.AFTER_CURRENT) {
      const startDate = addDays(toDateString(current.endDate), 1);
      return this.inStudentLock(current.studentId, (tx) => this.createTerm(tx, { ...term, startDate }));
    }

    if (!canCancel) throw AppException.forbidden('Only the mess owner can change a plan immediately');
    return this.inStudentLock(current.studentId, async (tx) => {
      await this.cancelInTx(tx, messId, id);
      return this.createTerm(tx, { ...term, startDate: today });
    });
  }

  /** Marks the subscription cancelled. The record is kept for history; no refund logic. */
  async cancel(messId: string, id: string): Promise<SubscriptionDetail> {
    const current = await this.findOwned(messId, id);
    await this.inStudentLock(current.studentId, (tx) => this.cancelInTx(tx, messId, id));
    return this.get(messId, id);
  }

  // ── Student self-service ──

  async getMine(user: User): Promise<MySubscriptionResponse> {
    const student = await this.students.resolveSelf(user);
    if (!student) return { linked: false };
    const today = businessToday();
    const [current, upcoming] = await Promise.all([
      this.prisma.studentSubscription.findFirst({ where: { studentId: student.id, ...statusWhere(SubscriptionStatus.ACTIVE, today) } }),
      this.prisma.studentSubscription.findFirst({
        where: { studentId: student.id, ...statusWhere(SubscriptionStatus.UPCOMING, today) },
        orderBy: { startDate: 'asc' },
      }),
    ]);
    return {
      linked: true,
      messName: student.mess.name,
      current: current && toSubscriptionSummary(current, today),
      upcoming: upcoming && toSubscriptionSummary(upcoming, today),
    };
  }

  async listMine(user: User, query: PaginationQueryDto): Promise<Paginated<SubscriptionSummary>> {
    const student = await this.students.resolveSelf(user);
    if (!student) return new Paginated([], 0, query);
    const where = { studentId: student.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.studentSubscription.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.studentSubscription.count({ where }),
    ]);
    const today = businessToday();
    return new Paginated(rows.map((r) => toSubscriptionSummary(r, today)), total, query);
  }

  // ── Meal credits (used by attendance in a later sprint; nothing calls these yet) ──

  /** Atomically uses one meal from a limited subscription. Returns false when none are left or the plan is unlimited. */
  async consumeMealCredit(subscriptionId: string, db: Tx = this.prisma): Promise<boolean> {
    const { count } = await db.studentSubscription.updateMany({
      where: { id: subscriptionId, cancelledAt: null, remainingMealCredits: { gt: 0 } },
      data: { remainingMealCredits: { decrement: 1 } },
    });
    return count === 1;
  }

  /** Gives back one meal (e.g. an attendance correction), never above the total. */
  async restoreMealCredit(subscriptionId: string, db: Tx = this.prisma): Promise<boolean> {
    const affected = await db.$executeRaw`
      UPDATE "student_subscriptions" SET "remainingMealCredits" = "remainingMealCredits" + 1, "updatedAt" = now()
      WHERE id = ${subscriptionId}::uuid AND "remainingMealCredits" < "totalMealCredits"`;
    return affected === 1;
  }

  // ── Internals ──

  /** Serializes subscription writes per student so two requests cannot both pass the overlap check. */
  private inStudentLock<T>(studentId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`;
      return work(tx);
    });
  }

  private async createTerm(tx: Tx, term: NewTerm): Promise<SubscriptionDetail> {
    const student = await tx.messStudent.findFirst({
      where: { id: term.studentId, messId: term.messId },
      select: { status: true },
    });
    if (!student) throw AppException.notFound('Student not found');
    if (student.status !== StudentStatus.ACTIVE) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.STUDENT_NOT_ACTIVE,
        student.status === StudentStatus.ARCHIVED
          ? 'Archived students cannot get a new plan. Restore them first.'
          : 'Inactive students cannot get a new plan. Activate them first.',
      );
    }

    const plan = await this.plans.requireAssignable(term.messId, term.mealPlanId, tx);
    const endDate = term.endDate ?? calculateEndDate(term.startDate, plan.durationType, plan.durationValue);
    if (endDate < term.startDate) throw AppException.validation({ endDate: ['End date must be on or after the start date'] });

    const clash = await tx.studentSubscription.findFirst({
      where: overlapWhere(term.studentId, term.startDate, endDate),
      orderBy: { startDate: 'asc' },
    });
    if (clash) {
      const range = `${toDateString(clash.startDate)} to ${toDateString(clash.endDate)}`;
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.SUBSCRIPTION_OVERLAP,
        `These dates overlap "${clash.planName}" (${range}). Choose a start date after it ends, or cancel it first.`,
        { startDate: [`Overlaps ${clash.planName} (${range})`] },
      );
    }

    const row = await tx.studentSubscription.create({
      data: {
        messId: term.messId,
        studentId: term.studentId,
        mealPlanId: plan.id,
        kind: term.kind,
        planName: plan.name,
        planPricePaise: plan.pricePaise,
        breakfastIncluded: plan.breakfastIncluded,
        lunchIncluded: plan.lunchIncluded,
        dinnerIncluded: plan.dinnerIncluded,
        startDate: fromDateString(term.startDate),
        endDate: fromDateString(endDate),
        totalMealCredits: plan.mealCredits,
        remainingMealCredits: plan.mealCredits,
      },
      include: detailInclude,
    });
    return toSubscriptionDetail(row, businessToday());
  }

  private async cancelInTx(tx: Tx, messId: string, id: string) {
    const { count } = await tx.studentSubscription.updateMany({
      where: { id, messId, cancelledAt: null, endDate: { gte: fromDateString(businessToday()) } },
      data: { cancelledAt: new Date() },
    });
    if (count === 0) throw this.notChangeable('Only active or upcoming subscriptions can be cancelled');
  }

  private async findOwned(messId: string, id: string) {
    const row = await this.prisma.studentSubscription.findFirst({ where: { id, messId } });
    if (!row) throw this.notFound();
    return row;
  }

  private studentSearch(search: string): Prisma.MessStudentWhereInput[] {
    return search
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .map((term) => {
        const contains = { contains: term, mode: 'insensitive' as const };
        const digits = normalizeMobile(term) ?? term.replace(/\D/g, '');
        return {
          OR: [{ firstName: contains }, { lastName: contains }, ...(digits.length >= 3 ? [{ mobile: { contains: digits } }] : [])],
        };
      });
  }

  private orderBy(query: ListSubscriptionsQueryDto): Prisma.StudentSubscriptionOrderByWithRelationInput[] {
    if (query.expiringSoon || query.status === SubscriptionStatus.ACTIVE) return [{ endDate: 'asc' }, { id: 'asc' }];
    if (query.status === SubscriptionStatus.UPCOMING) return [{ startDate: 'asc' }, { id: 'asc' }];
    return [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  }

  private notChangeable(message: string) {
    return new AppException(HttpStatus.CONFLICT, ErrorCode.SUBSCRIPTION_NOT_CHANGEABLE, message);
  }

  private notFound() {
    return AppException.notFound('Subscription not found');
  }
}
