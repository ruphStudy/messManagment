'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { CalendarX, SearchX } from 'lucide-react';
import {
  businessToday,
  can,
  formatPaise,
  PAYMENT_STATUS_LABELS,
  Permission,
  SubscriptionPaymentStatus,
  type DueItem,
  type MonthlyPaymentStatus,
} from '@mess/shared';
import { DueList } from '@/components/payments/due-list';
import { PaymentTabs } from '@/components/payments/payment-tabs';
import { RecordPaymentDialog } from '@/components/payments/record-payment-dialog';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { fullName } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

function MonthlyScreen() {
  const { session } = useAuth();
  const canRecord = can(session?.role, Permission.PAYMENT_RECORD);
  const currentMonth = businessToday().slice(0, 7);
  const list = useListParams({ month: currentMonth });
  const month = /^\d{4}-\d{2}$/.test(list.get('month')) ? list.get('month') : currentMonth;
  const paymentStatus = list.get('paid');
  const { page, search } = list;
  const [summary, setSummary] = useState<MonthlyPaymentStatus | null>(null);
  const [recording, setRecording] = useState<DueItem | null>(null);

  const loadSummary = () => api<MonthlyPaymentStatus>(`/payments/monthly/summary?month=${month}`).then(setSummary).catch(() => setSummary(null));
  useEffect(() => {
    setSummary(null);
    void loadSummary();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ month, page: String(page), pageSize: '25' });
    if (paymentStatus) q.set('paymentStatus', paymentStatus);
    if (search) q.set('search', search);
    return q.toString();
  }, [month, page, paymentStatus, search]);
  const { result, error, retry } = usePagedList<DueItem>(`/payments/monthly?${apiQuery}`);

  const cards = summary && [
    { label: 'Expected', value: formatPaise(summary.expectedPaise) },
    { label: 'Collected', value: formatPaise(summary.collectedPaise), tone: 'text-success' },
    { label: 'Pending', value: formatPaise(summary.pendingPaise), tone: 'text-danger' },
  ];

  return (
    <>
      <PageHeader title="Monthly payment status" description="Subscriptions running during the month and how much of their fee is paid. Not an invoice." />
      <PaymentTabs active="/payments/monthly" />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="month" className="text-sm font-medium">Month</label>
          <input id="month" type="month" value={month} onChange={(e) => e.target.value && list.setParams({ month: e.target.value, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
        </div>
        <p className="pb-2.5 text-ink-muted">{monthLabel(month)}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(cards ?? [{ label: 'Expected' }, { label: 'Collected' }, { label: 'Pending' }]).map((c) => (
          <Card key={c.label} className="p-4 sm:p-4">
            <p className="text-sm text-ink-muted">{c.label}</p>
            <p className={cn('text-xl font-bold', 'tone' in c && c.tone)}>{'value' in c ? c.value : '–'}</p>
          </Card>
        ))}
        {Object.values(SubscriptionPaymentStatus).map((s) => (
          <button
            key={s}
            onClick={() => list.setParams({ paid: paymentStatus === s ? null : s, page: 1 })}
            aria-pressed={paymentStatus === s}
            className={cn('rounded-card border bg-surface p-4 text-left', paymentStatus === s ? 'border-brand-500 ring-2 ring-brand-100' : 'border-border hover:border-brand-200')}
          >
            <p className="text-sm text-ink-muted">{PAYMENT_STATUS_LABELS[s]}</p>
            <p className="text-xl font-bold">{summary ? summary.counts[s] : '–'}</p>
          </button>
        ))}
      </div>

      <div className="mb-4"><SearchInput label="Search student" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student name or mobile…" /></div>

      {error ? (
        <ErrorState title="Couldn't load this month" description={error} onRetry={retry} />
      ) : !result ? (
        <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</Card>
      ) : result.data.length === 0 ? (
        search || paymentStatus ? <EmptyState icon={SearchX} title="No subscriptions match your filters." /> : <EmptyState icon={CalendarX} title="No subscriptions in this month." />
      ) : (
        <>
          <DueList items={result.data} onRecord={canRecord ? setRecording : undefined} />
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}
      <RecordPaymentDialog
        open={!!recording}
        student={recording ? { id: recording.student.id, name: fullName(recording.student) } : undefined}
        subscriptionId={recording?.subscriptionId}
        onClose={() => setRecording(null)}
        onDone={() => { setRecording(null); retry(); void loadSummary(); }}
      />
    </>
  );
}

export default function MonthlyPage() {
  return <Suspense><MonthlyScreen /></Suspense>;
}
