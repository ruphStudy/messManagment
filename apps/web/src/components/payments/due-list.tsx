'use client';

import Link from 'next/link';
import { formatPaise, type DueItem } from '@mess/shared';
import { SubscriptionStatusBadge } from '@/components/subscriptions/subscription-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate, formatMobile, fullName } from '@/lib/format';
import { PaymentStatusBadge } from './payment-badges';

/** Subscriptions with fee / paid / due — used by Pending dues and Monthly status. */
export function DueList({ items, onRecord }: { items: DueItem[]; onRecord?: (item: DueItem) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((d) => (
        <li key={d.subscriptionId}>
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/students/${d.student.id}`} className="font-semibold hover:underline">{fullName(d.student)}</Link>
                <PaymentStatusBadge status={d.payment.status} />
                <SubscriptionStatusBadge status={d.subscriptionStatus} />
              </div>
              <p className="text-sm text-ink-muted">
                {formatMobile(d.student.mobile)} · <Link href={`/subscriptions/${d.subscriptionId}`} className="hover:underline">{d.planName}</Link> · {formatDate(d.startDate)} – {formatDate(d.endDate)}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-sm sm:w-72">
              <div><dt className="text-ink-muted">Fee</dt><dd className="font-medium">{formatPaise(d.payment.payablePaise)}</dd></div>
              <div><dt className="text-ink-muted">Paid</dt><dd className="font-medium">{formatPaise(d.payment.paidPaise)}</dd></div>
              <div><dt className="text-ink-muted">Due</dt><dd className="font-bold text-danger">{formatPaise(d.payment.duePaise)}</dd></div>
            </dl>
            {onRecord && d.payment.duePaise > 0 && <Button size="sm" onClick={() => onRecord(d)}>Record payment</Button>}
          </Card>
        </li>
      ))}
    </ul>
  );
}
