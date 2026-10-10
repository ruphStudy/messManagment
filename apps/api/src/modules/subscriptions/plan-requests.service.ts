import { HttpStatus, Injectable } from '@nestjs/common';
import { MealPlanStatus, Prisma, StudentStatus, type User } from '@prisma/client';
import { addDays, businessToday, ErrorCode, type MealPlan, type PlanRequestItem } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { toDateString } from '../../common/http/dates';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { StudentsService } from '../students/students.service';
import { SubscriptionsService } from './subscriptions.service';

const studentSelect = { id: true, firstName: true, lastName: true, mobile: true } as const;
type Row = Prisma.PlanRequestGetPayload<{ include: { student: { select: typeof studentSelect } } }>;

const toItem = (r: Row, team: boolean): PlanRequestItem => ({
  id: r.id,
  status: r.status,
  mealPlanId: r.mealPlanId,
  planName: r.planName,
  planPricePaise: r.planPricePaise,
  createdAt: r.createdAt.toISOString(),
  decidedAt: r.decidedAt?.toISOString() ?? null,
  rejectReason: r.rejectReason,
  subscriptionId: r.subscriptionId,
  ...(team ? { student: r.student } : {}),
});

/**
 * Student-chosen plans: a student (in the selected mess) requests an ACTIVE plan; an owner/manager approves it,
 * which creates the subscription through the normal SubscriptionsService.assign (same overlap/plan/student
 * rules, credits and payments), or rejects it. A request never grants meals by itself.
 */
@Injectable()
export class PlanRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    private readonly plans: MealPlansService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // ── Student ──

  /** ACTIVE plans of the student's selected mess (x-mess-id). */
  async availablePlans(user: User): Promise<MealPlan[]> {
    const student = await this.students.resolveSelf(user);
    if (!student) return [];
    return this.plans.list(student.messId, { status: MealPlanStatus.ACTIVE } as never);
  }

  async myRequests(user: User): Promise<PlanRequestItem[]> {
    const student = await this.students.resolveSelf(user);
    if (!student) return [];
    const rows = await this.prisma.planRequest.findMany({ where: { studentId: student.id }, include: { student: { select: studentSelect } }, orderBy: { createdAt: 'desc' }, take: 20 });
    // Start date of the subscription each approval created (display only: "Active now" / "Starts …").
    const subIds = rows.map((r) => r.subscriptionId).filter((v): v is string => !!v);
    const subs = subIds.length ? await this.prisma.studentSubscription.findMany({ where: { id: { in: subIds }, studentId: student.id }, select: { id: true, startDate: true } }) : [];
    const starts = new Map(subs.map((x) => [x.id, toDateString(x.startDate)]));
    return rows.map((r) => ({ ...toItem(r, false), subscriptionStartDate: r.subscriptionId ? (starts.get(r.subscriptionId) ?? null) : null }));
  }

  async request(user: User, mealPlanId: string): Promise<PlanRequestItem> {
    const student = await this.students.resolveSelf(user);
    if (!student) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.STUDENT_NOT_LINKED, 'Your mess has not added your mobile number yet');
    if (student.status !== StudentStatus.ACTIVE) throw new AppException(HttpStatus.CONFLICT, ErrorCode.STUDENT_NOT_ACTIVE, 'Your membership is inactive. Please contact your mess.');
    // Plan must be an ACTIVE plan of this same mess (a guessed id from another mess is "not found").
    const plan = await this.prisma.mealPlan.findFirst({ where: { id: mealPlanId, messId: student.messId } });
    if (!plan) throw AppException.notFound('Meal plan not found');
    if (plan.status !== MealPlanStatus.ACTIVE) throw new AppException(HttpStatus.CONFLICT, ErrorCode.PLAN_INACTIVE, 'This plan is no longer available');
    try {
      const row = await this.prisma.planRequest.create({
        data: { messId: student.messId, studentId: student.id, mealPlanId: plan.id, planName: plan.name, planPricePaise: plan.pricePaise },
        include: { student: { select: studentSelect } },
      });
      return toItem(row, false);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException(HttpStatus.CONFLICT, ErrorCode.PLAN_REQUEST_PENDING, 'You already have a plan request waiting for your mess. Withdraw it to choose another plan.');
      }
      throw e;
    }
  }

  async withdraw(user: User, id: string): Promise<PlanRequestItem> {
    const student = await this.students.resolveSelf(user);
    if (!student) throw this.notFound();
    const { count } = await this.prisma.planRequest.updateMany({ where: { id, studentId: student.id, status: 'PENDING' }, data: { status: 'CANCELLED', decidedAt: new Date() } });
    if (!count) throw this.notFound();
    return toItem(await this.prisma.planRequest.findUniqueOrThrow({ where: { id }, include: { student: { select: studentSelect } } }), false);
  }

  // ── Owner / manager ──

  async list(messId: string, status?: string): Promise<PlanRequestItem[]> {
    const rows = await this.prisma.planRequest.findMany({
      where: { messId, ...(status ? { status: status as never } : {}) },
      include: { student: { select: studentSelect } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return rows.map((r) => toItem(r, true));
  }

  async pendingCount(messId: string) {
    return { count: await this.prisma.planRequest.count({ where: { messId, status: 'PENDING' } }) };
  }

  /** Creates the subscription via SubscriptionsService.assign (all existing rules), starting today or after the student's current/upcoming plan. */
  async approve(messId: string, userId: string, id: string): Promise<PlanRequestItem> {
    const req = await this.prisma.planRequest.findFirst({ where: { id, messId } });
    if (!req) throw this.notFound();
    if (req.status !== 'PENDING') throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'This request was already handled');
    const latest = await this.prisma.studentSubscription.findFirst({ where: { studentId: req.studentId, cancelledAt: null }, orderBy: { endDate: 'desc' }, select: { endDate: true } });
    const today = businessToday();
    const after = latest ? addDays(toDateString(latest.endDate), 1) : today;
    const startDate = after > today ? after : today;
    const sub = await this.subscriptions.assign(messId, req.studentId, { mealPlanId: req.mealPlanId, startDate } as never);
    // Conditional: a concurrent approve/reject loses cleanly (the subscription above is then the only one made).
    await this.prisma.planRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', decidedById: userId, decidedAt: new Date(), subscriptionId: sub.id } });
    return this.one(messId, id);
  }

  async reject(messId: string, userId: string, id: string, reason?: string): Promise<PlanRequestItem> {
    const { count } = await this.prisma.planRequest.updateMany({ where: { id, messId, status: 'PENDING' }, data: { status: 'REJECTED', decidedById: userId, decidedAt: new Date(), rejectReason: reason?.trim() || null } });
    if (!count) throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT, 'This request was already handled');
    return this.one(messId, id);
  }

  private async one(messId: string, id: string) {
    const row = await this.prisma.planRequest.findFirst({ where: { id, messId }, include: { student: { select: studentSelect } } });
    if (!row) throw this.notFound();
    return toItem(row, true);
  }

  private notFound() {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.PLAN_REQUEST_NOT_FOUND, 'Plan request not found');
  }
}
