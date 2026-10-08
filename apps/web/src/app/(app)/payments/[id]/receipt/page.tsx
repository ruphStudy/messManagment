'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { formatPaise, PAYMENT_METHOD_LABELS, PaymentTransactionStatus, type PaymentReceipt } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/loader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatMobile, fullName } from '@/lib/format';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-border py-2 last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** Printable receipt (browser print / save as PDF). Not a tax invoice. */
export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<PaymentReceipt>(`/payments/${id}/receipt`)
      .then(setReceipt)
      .catch((e: unknown) => setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 }));
  }, [id]);
  useEffect(load, [load]);

  if (error) return error.notFound ? <EmptyState title="Receipt not found" /> : <ErrorState description={error.message} onRetry={load} />;
  if (!receipt) return <PageLoader />;
  const reversed = receipt.status === PaymentTransactionStatus.REVERSED;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/payments" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Payments
        </Link>
        <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print / Save PDF</Button>
      </div>

      <article className="relative rounded-card border border-border bg-surface p-6 print:border-0 print:p-0">
        {reversed && (
          <p className="mb-4 rounded-control bg-danger-soft p-2 text-center text-sm font-bold text-danger">REVERSED — this payment was cancelled{receipt.reversedAt && ` on ${formatDateTime(receipt.reversedAt)}`}</p>
        )}
        <header className="mb-4 text-center">
          <h1 className="text-xl font-bold">{receipt.mess.name}</h1>
          <p className="text-sm text-ink-muted">{receipt.mess.address}, {receipt.mess.city} · {formatMobile(receipt.mess.mobile)}</p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide">Payment receipt</p>
          <p className="font-mono text-sm">{receipt.receiptNumber}</p>
        </header>
        <p className="mb-4 text-center text-3xl font-bold">{formatPaise(receipt.amountPaise)}</p>
        <dl className="text-sm">
          <Row label="Received from" value={`${fullName(receipt.student)} (${formatMobile(receipt.student.mobile)})`} />
          <Row label="For" value={`${receipt.subscription.planName}, ${formatDate(receipt.subscription.startDate)} – ${formatDate(receipt.subscription.endDate)}`} />
          <Row label="Payment date" value={formatDate(receipt.paymentDate)} />
          <Row label="Method" value={PAYMENT_METHOD_LABELS[receipt.method]} />
          {receipt.referenceNumber && <Row label="Reference" value={receipt.referenceNumber} />}
          <Row label="Balance after this payment" value={formatPaise(receipt.balanceAfterPaise)} />
          <Row label="Balance now" value={formatPaise(receipt.currentDuePaise)} />
          {receipt.recordedBy && <Row label="Recorded by" value={receipt.recordedBy} />}
        </dl>
        <p className="mt-4 text-center text-xs text-ink-muted">Generated {formatDateTime(receipt.generatedAt)} · This is a payment acknowledgement, not a tax invoice.</p>
      </article>
    </div>
  );
}
