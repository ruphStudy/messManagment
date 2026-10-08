import { Injectable } from '@nestjs/common';
import { StudentStatus } from '@prisma/client';
import {
  addDays,
  businessToday,
  can,
  formatPaise,
  Permission,
  SubscriptionStatus,
  type DashboardActionItem,
  type DashboardOverview,
  type Role,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { fromDateString, monthRange } from '../../common/http/dates';
import { ComplaintsService } from '../complaints/complaints.service';
import { ExpenseSummaryService } from '../expenses/expense-summary.service';
import { FeedbackService } from '../feedback/feedback.service';
import { MenusService } from '../menus/menus.service';
import { MealCountsService } from '../pauses/meal-counts.service';
import { PaymentsService } from '../payments/payments.service';
import { expiringSoonWhere, statusWhere } from '../subscriptions/subscription.rules';

/**
 * One call for the whole dashboard. Every figure comes from the same service/rule the source module uses
 * (meal counts, payment dashboard, finance estimate, rating summary, complaint counts), so numbers always match.
 * Sections the role may not see are not computed at all.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mealCounts: MealCountsService,
    private readonly menus: MenusService,
    private readonly payments: PaymentsService,
    private readonly expenses: ExpenseSummaryService,
    private readonly feedback: FeedbackService,
    private readonly complaints: ComplaintsService,
  ) {}

  async overview(messId: string, role: Role): Promise<DashboardOverview> {
    const today = businessToday();
    const tomorrow = addDays(today, 1);
    const month = today.slice(0, 7);
    const { start: monthStart } = monthRange(month);
    const business = can(role, Permission.DASHBOARD_BUSINESS_VIEW);
    const finance = can(role, Permission.FINANCE_VIEW);
    const ratings = can(role, Permission.FEEDBACK_VIEW);

    const [mealsToday, mealsTomorrow, menuDay, students, subscriptions, money, feedback, complaints] = await Promise.all([
      this.mealCounts.forDate(messId, today),
      this.mealCounts.forDate(messId, tomorrow),
      this.menus.getDay(messId, today),
      business ? this.studentCounts(messId, monthStart) : undefined,
      business ? this.subscriptionCounts(messId, today) : undefined,
      finance ? this.money(messId, today, month) : undefined,
      business && ratings ? this.feedback.summary(messId, monthStart, today) : undefined,
      business ? this.complaintCounts(messId, monthStart) : undefined,
    ]);

    const menuStatus = !menuDay.menu ? 'NOT_CREATED' : menuDay.menu.isPublished ? 'PUBLISHED' : 'DRAFT';
    const overview: DashboardOverview = {
      dates: { today, tomorrow, month },
      meals: { today: mealsToday, tomorrow: mealsTomorrow },
      menu: { status: menuStatus },
      ...(students && { students }),
      ...(subscriptions && { subscriptions }),
      ...(money && { money }),
      ...(feedback && { feedback: { monthAverage: feedback.averages.overall, monthCount: feedback.mealCount + feedback.generalCount, averages: feedback.averages } }),
      ...(complaints && { complaints }),
      actionItems: [],
    };
    overview.actionItems = this.actionItems(overview, business);
    return overview;
  }

  /** Simple rule-based to-dos; each links to the screen that fixes it. */
  private actionItems(o: DashboardOverview, business: boolean): DashboardActionItem[] {
    const items: DashboardActionItem[] = [];
    if (business && o.menu.status !== 'PUBLISHED') {
      items.push({ key: 'MENU_NOT_PUBLISHED', label: o.menu.status === 'DRAFT' ? "Today's menu is still a draft" : "Today's menu isn't created yet", count: 1, href: '/menu' });
    }
    if (o.subscriptions?.expiringSoon) items.push({ key: 'EXPIRING_PLANS', label: 'Plans ending within 7 days (no renewal)', count: o.subscriptions.expiringSoon, href: '/subscriptions?view=expiring' });
    if (o.money?.studentsWithDues) {
      items.push({ key: 'STUDENTS_WITH_DUES', label: `Students owing ${formatPaise(o.money.pendingDuesPaise)}`, count: o.money.studentsWithDues, href: '/payments/dues' });
    }
    if (o.complaints?.OPEN) items.push({ key: 'OPEN_COMPLAINTS', label: 'Open complaints', count: o.complaints.OPEN, href: '/complaints?status=OPEN' });
    return items;
  }

  private async studentCounts(messId: string, monthStart: string) {
    const [groups, joined] = await Promise.all([
      this.prisma.messStudent.groupBy({ by: ['status'], where: { messId }, _count: { _all: true } }),
      this.prisma.messStudent.count({ where: { messId, status: { not: StudentStatus.ARCHIVED }, joiningDate: { gte: fromDateString(monthStart) } } }),
    ]);
    const count = (s: StudentStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
    return { active: count(StudentStatus.ACTIVE), inactive: count(StudentStatus.INACTIVE), joinedThisMonth: joined };
  }

  private async subscriptionCounts(messId: string, today: string) {
    const day = fromDateString(today);
    const [active, upcoming, expiringSoon, endedWithoutRenewal] = await Promise.all([
      this.prisma.studentSubscription.count({ where: { messId, ...statusWhere(SubscriptionStatus.ACTIVE, today) } }),
      this.prisma.studentSubscription.count({ where: { messId, ...statusWhere(SubscriptionStatus.UPCOMING, today) } }),
      // Same rule as the Subscriptions "Expiring soon" filter.
      this.prisma.studentSubscription.count({ where: { messId, ...expiringSoonWhere(today) } }),
      // Ended in the last 7 days and the (active) student has nothing current or upcoming.
      this.prisma.studentSubscription.count({
        where: {
          messId,
          cancelledAt: null,
          endDate: { gte: fromDateString(addDays(today, -7)), lt: day },
          student: { status: StudentStatus.ACTIVE, subscriptions: { none: { cancelledAt: null, endDate: { gte: day } } } },
        },
      }),
    ]);
    return { active, upcoming, expiringSoon, endedWithoutRenewal };
  }

  private async money(messId: string, today: string, month: string) {
    const [paymentSummary, expensesToday, balance] = await Promise.all([
      this.payments.dashboard(messId),
      this.expenses.summary(messId, today, today),
      this.expenses.financeMonthly(messId, month),
    ]);
    return {
      collectedTodayPaise: paymentSummary.collectedTodayPaise,
      collectedThisMonthPaise: paymentSummary.collectedThisMonthPaise,
      pendingDuesPaise: paymentSummary.pendingDuesPaise,
      studentsWithDues: paymentSummary.studentsWithDues,
      expensesTodayPaise: expensesToday.totalPaise,
      expensesThisMonthPaise: balance.expensesPaise,
      balance,
    };
  }

  private async complaintCounts(messId: string, monthStart: string) {
    const [counts, resolvedThisMonth] = await Promise.all([
      this.complaints.counts(messId),
      this.prisma.complaint.count({ where: { messId, resolvedAt: { gte: fromDateString(monthStart) } } }),
    ]);
    return { ...counts, resolvedThisMonth };
  }
}
