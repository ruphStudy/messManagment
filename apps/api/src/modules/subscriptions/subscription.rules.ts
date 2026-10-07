import type { Prisma } from '@prisma/client';
import { addDays, EXPIRING_SOON_DAYS, SubscriptionStatus } from '@mess/shared';
import { fromDateString } from '../../common/http/dates';

/**
 * Database form of the shared `subscriptionStatus()` rule. Status is never stored (except cancellation),
 * so filters stay correct without background jobs.
 */
export function statusWhere(status: SubscriptionStatus, today: string): Prisma.StudentSubscriptionWhereInput {
  const day = fromDateString(today);
  switch (status) {
    case SubscriptionStatus.CANCELLED:
      return { cancelledAt: { not: null } };
    case SubscriptionStatus.UPCOMING:
      return { cancelledAt: null, startDate: { gt: day } };
    case SubscriptionStatus.EXPIRED:
      return { cancelledAt: null, endDate: { lt: day } };
    case SubscriptionStatus.ACTIVE:
      return { cancelledAt: null, startDate: { lte: day }, endDate: { gte: day } };
  }
}

/** Active, ending within EXPIRING_SOON_DAYS, and the student has nothing lined up after it. */
export function expiringSoonWhere(today: string): Prisma.StudentSubscriptionWhereInput {
  return {
    ...statusWhere(SubscriptionStatus.ACTIVE, today),
    endDate: { gte: fromDateString(today), lte: fromDateString(addDays(today, EXPIRING_SOON_DAYS)) },
    student: { subscriptions: { none: { cancelledAt: null, startDate: { gt: fromDateString(today) } } } },
  };
}

/** Non-cancelled subscriptions of a student whose dates intersect [start, end]. */
export function overlapWhere(studentId: string, start: string, end: string): Prisma.StudentSubscriptionWhereInput {
  return { studentId, cancelledAt: null, startDate: { lte: fromDateString(end) }, endDate: { gte: fromDateString(start) } };
}
