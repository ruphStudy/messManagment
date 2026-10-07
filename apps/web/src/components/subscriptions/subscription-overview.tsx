import Link from 'next/link';
import { mealsLabel, SubscriptionStatus, type SubscriptionSummary } from '@mess/shared';
import { formatDate, formatPrice } from '@/lib/format';
import { mealsLeftLabel, SubscriptionStatusBadge } from './subscription-badges';

/** Compact facts block for one subscription (used on student detail). */
export function SubscriptionOverview({ sub }: { sub: SubscriptionSummary }) {
  const facts: [string, string][] = [
    ['Meals', mealsLabel(sub.plan)],
    ['Validity', `${formatDate(sub.startDate)} – ${formatDate(sub.endDate)}`],
    ['Meals left', mealsLeftLabel(sub)],
    [sub.status === SubscriptionStatus.ACTIVE ? 'Days left' : 'Price', sub.daysRemaining !== null ? String(sub.daysRemaining) : formatPrice(sub.plan.price)],
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/subscriptions/${sub.id}`} className="text-lg font-semibold hover:underline">{sub.plan.name}</Link>
        <SubscriptionStatusBadge status={sub.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
