'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { formatPaise, PAYMENT_METHOD_LABELS, PaymentTransactionStatus, type PaymentReceipt } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/student/use-api';

/** Read-only receipt for one of the student's own payments (print-friendly). */
export default function StudentReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error, reload } = useApi<PaymentReceipt>(`/students/me/payments/${id}`);
  if (error) return error.toLowerCase().includes('not found') ? <EmptyState title="Receipt not found" /> : <ErrorState description={error} onRetry={reload} />;
  if (!r) return <Skeleton className="mx-auto h-96 max-w-lg" />;
  const reversed = r.status === PaymentTransactionStatus.REVERSED;
  const rows: [string, string | null][] = [
    ['Plan', r.subscription.planName],
    ['Plan dates', `${formatDate(r.subscription.startDate)} – ${formatDate(r.subscription.endDate)}`],
    ['Paid on', formatDate(r.paymentDate)],
    ['Method', PAYMENT_METHOD_LABELS[r.method]],
    ['Reference', r.referenceNumber],
    ['Due after this payment', formatPaise(r.balanceAfterPaise)],
    ['Due now', formatPaise(r.currentDuePaise)],
    ['Received by', r.recordedBy],
  ];
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/student/payments" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden /> Payments</Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print</Button>
      </div>
      <Card className="text-center">
        <p className="text-lg font-semibold">{r.mess.name}</p>
        <p className="text-sm text-ink-muted">Payment receipt · {r.receiptNumber}</p>
        <p className={`mt-2 text-4xl font-bold ${reversed ? 'text-ink-muted line-through' : ''}`}>{formatPaise(r.amountPaise)}</p>
        {reversed && <p className="mt-1 font-semibold text-danger">This payment was cancelled by the mess</p>}
      </Card>
      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
      </Card>
    </div>
  );
}
