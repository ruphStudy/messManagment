'use client';

import Link from 'next/link';
import { formatPaise, PAYMENT_METHOD_LABELS, PaymentTransactionStatus, type PaymentRecord } from '@mess/shared';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { TransactionBadge } from './payment-badges';

export function RecentPayments({ payments, showPlan = false }: { payments: PaymentRecord[]; showPlan?: boolean }) {
  if (!payments.length) return <p className="text-sm text-ink-muted">No payments recorded yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {payments.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
          <span className={cn('font-bold', p.status === PaymentTransactionStatus.REVERSED && 'line-through')}>{formatPaise(p.amountPaise)}</span>
          <span className="text-ink-muted">{formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]}{showPlan && ` · ${p.subscription.planName}`}</span>
          <TransactionBadge status={p.status} />
          <Link href={`/payments/${p.id}/receipt`} className="ml-auto font-medium text-brand-700 hover:underline">{p.receiptNumber}</Link>
        </li>
      ))}
    </ul>
  );
}
