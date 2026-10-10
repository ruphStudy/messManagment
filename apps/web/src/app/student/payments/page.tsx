'use client';

import Link from 'next/link';
import { ChevronRight, Receipt, Undo2 } from 'lucide-react';
import { formatPaise, PAYMENT_METHOD_LABELS, PaymentTransactionStatus, type PaymentRecord, type StudentFeesResponse } from '@mess/shared';
import { LinkedOnly } from '@/components/student/linked-only';
import { useLoadMore } from '@/components/student/paged';
import { FeeCard } from '@/components/student/student-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/student/use-api';

function Payments() {
  const fees = useApi<StudentFeesResponse>('/students/me/fees');
  const history = useLoadMore<PaymentRecord>('/students/me/payments');
  if (fees.error && !fees.data) return <ErrorState title="Couldn't load your fees" description={fees.error} onRetry={fees.reload} />;
  if (!fees.data || !fees.data.linked) return <Skeleton className="h-64" />;
  const { totalDuePaise, subscriptions, messName } = fees.data;
  return (
    <div className="flex flex-col gap-4">
      <Card className={totalDuePaise ? 'border-transparent bg-danger-soft' : 'border-transparent bg-success-soft'}>
        <p className="text-sm text-ink-muted">{totalDuePaise ? 'Amount due' : 'All fees'}</p>
        <p className={`text-3xl font-bold ${totalDuePaise ? 'text-danger' : 'text-success'}`}>{totalDuePaise ? formatPaise(totalDuePaise) : 'Paid in full'}</p>
        {totalDuePaise > 0 && <p className="text-sm text-ink-muted">Pay at {messName}. Payments made at the mess appear here.</p>}
      </Card>
      {subscriptions.length === 0 ? <Card><p className="text-ink-muted">Your mess has not assigned a meal plan yet.</p></Card> : <div className="grid gap-3 lg:grid-cols-2">{subscriptions.map((s) => <FeeCard key={s.id} sub={s} />)}</div>}

      <h2 className="mt-2 text-lg font-semibold">Payment history</h2>
      {history.error && !history.meta ? (
        <ErrorState title="Couldn't load payments" description={history.error} onRetry={() => history.load(1)} />
      ) : !history.meta ? (
        <Skeleton className="h-32" />
      ) : history.items.length === 0 ? (
        <Card><p className="text-ink-muted">No payments recorded yet.</p></Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.items.map((p) => {
            const reversed = p.status === PaymentTransactionStatus.REVERSED;
            return (
              <li key={p.id}>
                <Link href={`/student/payments/${p.id}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 hover:border-brand-300" aria-label={`Receipt ${p.receiptNumber}`}>
                  {reversed ? <Undo2 className="size-5 text-ink-muted" aria-hidden /> : <Receipt className="size-5 text-brand-600" aria-hidden />}
                  <span className="flex-1">
                    <span className={`block font-semibold ${reversed ? 'text-ink-muted line-through' : ''}`}>{formatPaise(p.amountPaise)} · {PAYMENT_METHOD_LABELS[p.method]}</span>
                    <span className="block text-sm text-ink-muted">{formatDate(p.paymentDate)} · {p.receiptNumber}{reversed ? ' · Cancelled by mess' : ''}</span>
                  </span>
                  <ChevronRight className="size-4 text-ink-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
          {history.hasMore && <Button variant="secondary" loading={history.loading} onClick={() => history.load(history.meta!.page + 1)}>Load more</Button>}
        </ul>
      )}
    </div>
  );
}

export default function StudentPaymentsPage() {
  return (
    <>
      <PageHeader title="Payments" description="Your fees, dues and receipts" />
      <LinkedOnly><Payments /></LinkedOnly>
    </>
  );
}
