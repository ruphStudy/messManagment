import { SUBSCRIPTION_STATUS_LABELS, SubscriptionStatus } from '@mess/shared';
import { Badge } from '@/components/ui/badge';

const TONE = {
  ACTIVE: 'success',
  UPCOMING: 'info',
  EXPIRED: 'neutral',
  CANCELLED: 'danger',
} as const;

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge tone={TONE[status]}>{SUBSCRIPTION_STATUS_LABELS[status]}</Badge>;
}

/** "12 / 30 meals", or "Unlimited" for validity-based plans. */
export function mealsLeftLabel(sub: { totalMealCredits: number | null; remainingMealCredits: number | null }) {
  return sub.totalMealCredits === null ? 'Unlimited' : `${sub.remainingMealCredits} / ${sub.totalMealCredits} meals`;
}
