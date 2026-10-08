import type { MealPlan, MessStudent, StudentSubscription } from '@prisma/client';
import {
  daysBetween,
  paymentSummary,
  SubscriptionStatus,
  subscriptionStatus,
  type SubscriptionDetail,
  type SubscriptionListItem,
  type SubscriptionSummary,
} from '@mess/shared';
import { toDateString } from '../../common/http/dates';

export const studentSummarySelect = { id: true, firstName: true, lastName: true, mobile: true, status: true } as const;
type StudentRow = Pick<MessStudent, keyof typeof studentSummarySelect>;

export function toSubscriptionSummary(row: StudentSubscription, today: string): SubscriptionSummary {
  const startDate = toDateString(row.startDate);
  const endDate = toDateString(row.endDate);
  const status = subscriptionStatus({ startDate, endDate, cancelledAt: row.cancelledAt }, today);
  return {
    id: row.id,
    mealPlanId: row.mealPlanId,
    status,
    kind: row.kind,
    startDate,
    endDate,
    plan: {
      name: row.planName,
      price: row.planPricePaise / 100,
      breakfastIncluded: row.breakfastIncluded,
      lunchIncluded: row.lunchIncluded,
      dinnerIncluded: row.dinnerIncluded,
    },
    totalMealCredits: row.totalMealCredits,
    remainingMealCredits: row.remainingMealCredits,
    daysRemaining: status === SubscriptionStatus.ACTIVE ? daysBetween(today, endDate) + 1 : null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    payment: paymentSummary(row.planPricePaise, row.amountPaidPaise),
  };
}

export function toSubscriptionListItem(row: StudentSubscription & { student: StudentRow }, today: string): SubscriptionListItem {
  const { status: _status, ...student } = row.student;
  return { ...toSubscriptionSummary(row, today), student };
}

export function toSubscriptionDetail(
  row: StudentSubscription & { student: StudentRow; mealPlan: Pick<MealPlan, 'id' | 'name' | 'status'> | null },
  today: string,
): SubscriptionDetail {
  return {
    ...toSubscriptionSummary(row, today),
    student: row.student,
    mealPlan: row.mealPlan,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
