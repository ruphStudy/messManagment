'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt, SearchX, Undo2, Wallet, X } from 'lucide-react';
import {
  can,
  formatPaise,
  isValidDateString,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  PaymentTransactionStatus,
  Permission,
  type PaymentRecord,
} from '@mess/shared';
import { PersonName } from '@/components/ui/avatar';
import { TransactionBadge } from '@/components/payments/payment-badges';
import { PaymentTabs } from '@/components/payments/payment-tabs';
import { RecordPaymentDialog } from '@/components/payments/record-payment-dialog';
import { ReversePaymentDialog } from '@/components/payments/reverse-payment-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { formatDate, fullName } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

function PaymentsScreen() {
  const { session } = useAuth();
  const canRecord = can(session?.role, Permission.PAYMENT_RECORD);
  const canReverse = can(session?.role, Permission.PAYMENT_REVERSE);
  const list = useListParams();
  const from = list.get('from');
  const to = list.get('to');
  const method = list.get('method');
  const status = list.get('status');
  const { page, search } = list;
  // `?record=1` (dashboard quick action) opens the dialog straight away.
  const [recording, setRecording] = useState(() => list.get('record') === '1' && canRecord);
  const [reversing, setReversing] = useState<PaymentRecord | null>(null);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (isValidDateString(from)) q.set('from', from);
    if (isValidDateString(to)) q.set('to', to);
    if (method) q.set('method', method);
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    return q.toString();
  }, [page, from, to, method, status, search]);
  const { result, error, retry } = usePagedList<PaymentRecord>(`/payments?${apiQuery}`);
  const hasFilters = !!(from || to || method || status || search);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received from students"
        actions={canRecord && <Button onClick={() => setRecording(true)}><Plus className="size-4" aria-hidden /> Record payment</Button>}
      />
      <PaymentTabs active="/payments" />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end">
        <SearchInput label="Search student" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student name or mobile…" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-sm font-medium">From</label>
          <input id="from" type="date" value={from} onChange={(e) => list.setParams({ from: e.target.value, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-sm font-medium">To</label>
          <input id="to" type="date" value={to} onChange={(e) => list.setParams({ to: e.target.value, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
        </div>
        <Select id="method" label="Method" options={[{ value: '', label: 'All methods' }, ...Object.values(PaymentMethod).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))]} value={method} onChange={(e) => list.setParams({ method: e.target.value, page: 1 })} />
        <Select id="status" label="Status" options={[{ value: '', label: 'All' }, { value: 'RECORDED', label: 'Received' }, { value: 'REVERSED', label: 'Reversed' }]} value={status} onChange={(e) => list.setParams({ status: e.target.value, page: 1 })} />
      </div>
      {hasFilters && (
        <button onClick={() => list.clear(['from', 'to', 'method', 'status'])} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {error ? (
        <ErrorState title="Couldn't load payments" description={error} onRetry={retry} />
      ) : !result ? (
        <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6" />)}</Card>
      ) : result.data.length === 0 ? (
        hasFilters ? <EmptyState icon={SearchX} title="No payments match your filters." /> : (
          <EmptyState icon={Wallet} title="No payments recorded yet." description="Record cash or UPI payments as students pay." action={canRecord && <Button onClick={() => setRecording(true)}>Record payment</Button>} />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {result.data.map((p) => {
              const reversed = p.status === PaymentTransactionStatus.REVERSED;
              return (
                <li key={p.id}>
                  <Card className={cn('flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-4', reversed && 'bg-canvas')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('text-lg font-bold', reversed && 'line-through decoration-1')}>{formatPaise(p.amountPaise)}</span>
                        <PersonName name={fullName(p.student)} className="font-semibold" />
                        <TransactionBadge status={p.status} />
                      </div>
                      <p className="text-sm text-ink-muted">
                        {formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]}{p.referenceNumber && ` (${p.referenceNumber})`} · {p.subscription.planName} · {p.receiptNumber}
                        {p.recordedBy && ` · by ${p.recordedBy}`}
                      </p>
                      {reversed && <p className="text-sm text-danger">Reversed{p.reversedBy && ` by ${p.reversedBy}`}{p.reversalReason && ` — ${p.reversalReason}`}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/payments/${p.id}/receipt`} className="inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                        <Receipt className="size-4" aria-hidden /> Receipt
                      </Link>
                      {canReverse && !reversed && (
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setReversing(p)}><Undo2 className="size-4" aria-hidden /> Reverse</Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}

      <RecordPaymentDialog open={recording} onClose={() => { setRecording(false); list.setParams({ record: null }); }} onDone={() => { setRecording(false); list.setParams({ record: null }); retry(); }} />
      <ReversePaymentDialog payment={reversing} onClose={() => setReversing(null)} onDone={() => { setReversing(null); retry(); }} />
    </>
  );
}

export default function PaymentsPage() {
  return <Suspense><PaymentsScreen /></Suspense>;
}
