'use client';

import { Suspense, useMemo, useState } from 'react';
import { CheckCircle2, SearchX } from 'lucide-react';
import { can, NOTIFICATION_LIMITS, Permission, SubscriptionStatus, type DueItem, type ReminderResult } from '@mess/shared';
import { ReminderResultSummary } from '@/components/notifications/reminder-result';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { DueList } from '@/components/payments/due-list';
import { PaymentTabs } from '@/components/payments/payment-tabs';
import { RecordPaymentDialog } from '@/components/payments/record-payment-dialog';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-context';
import { fullName } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

function DuesScreen() {
  const { session } = useAuth();
  const canRecord = can(session?.role, Permission.PAYMENT_RECORD);
  const canRemind = can(session?.role, Permission.REMINDER_SEND);
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAll, setConfirmAll] = useState(false);
  const [sending, setSending] = useState(false);
  const [reminderResult, setReminderResult] = useState<ReminderResult | null>(null);

  const toggle = (id: string) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else if (next.size < NOTIFICATION_LIMITS.bulkMax) next.add(id);
    return next;
  });

  /** Payment reminders (amount filled in by the server). Duplicate clicks within minutes are skipped server-side. */
  const remind = async (body: { studentIds?: string[]; allWithDues?: boolean }) => {
    setSending(true);
    try {
      const result = await api<ReminderResult>('/reminders/payment-due/bulk', { method: 'POST', body });
      setReminderResult(result);
      setSelected(new Set());
      toast.success(`${result.sent.length} ${result.sent.length === 1 ? 'reminder' : 'reminders'} sent`);
    } catch (e) {
      toast.error('Could not send reminders', errorMessage(e));
    } finally {
      setSending(false);
      setConfirmAll(false);
    }
  };
  const list = useListParams();
  const status = list.get('status');
  const { page, search } = list;
  const [recording, setRecording] = useState<DueItem | null>(null);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (status) q.set('subscriptionStatus', status);
    if (search) q.set('search', search);
    return q.toString();
  }, [page, status, search]);
  const { result, error, retry } = usePagedList<DueItem>(`/payments/dues?${apiQuery}`);

  return (
    <>
      <PageHeader title="Pending dues" description="Subscriptions with money still to collect, oldest first" />
      <PaymentTabs active="/payments/dues" />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <SearchInput label="Search student" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student name or mobile…" />
        <Select
          id="status"
          label="Plan"
          className="sm:w-48"
          options={[{ value: '', label: 'All' }, { value: SubscriptionStatus.ACTIVE, label: 'Current plans' }, { value: SubscriptionStatus.EXPIRED, label: 'Ended plans' }, { value: SubscriptionStatus.UPCOMING, label: 'Upcoming plans' }]}
          value={status}
          onChange={(e) => list.setParams({ status: e.target.value, page: 1 })}
        />
      </div>
      {canRemind && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={!selected.size} loading={sending && !confirmAll} onClick={() => remind({ studentIds: [...selected] })}>
            Remind selected{selected.size ? ` (${selected.size})` : ''}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmAll(true)}>Remind everyone with dues</Button>
          {selected.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear selection</Button>}
        </div>
      )}
      {reminderResult && <div className="mb-4"><ReminderResultSummary result={reminderResult} /></div>}
      {error ? (
        <ErrorState title="Couldn't load dues" description={error} onRetry={retry} />
      ) : !result ? (
        <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</Card>
      ) : result.data.length === 0 ? (
        search || status ? <EmptyState icon={SearchX} title="No dues match your filters." /> : <EmptyState icon={CheckCircle2} title="No pending dues." description="Every subscription is fully paid." />
      ) : (
        <>
          <DueList
            items={result.data}
            onRecord={canRecord ? setRecording : undefined}
            onRemind={canRemind ? (d) => remind({ studentIds: [d.student.id] }) : undefined}
            selected={selected}
            onToggle={canRemind ? toggle : undefined}
          />
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}
      <ConfirmDialog
        open={confirmAll}
        title="Remind everyone with dues?"
        description={`Every student who owes money (up to ${NOTIFICATION_LIMITS.bulkMax}) gets an in-app payment reminder with their amount due. Students reminded in the last few minutes are skipped.`}
        confirmLabel="Send reminders"
        loading={sending}
        onConfirm={() => remind({ allWithDues: true })}
        onCancel={() => setConfirmAll(false)}
      />
      <RecordPaymentDialog
        open={!!recording}
        student={recording ? { id: recording.student.id, name: fullName(recording.student) } : undefined}
        subscriptionId={recording?.subscriptionId}
        onClose={() => setRecording(null)}
        onDone={() => { setRecording(null); retry(); }}
      />
    </>
  );
}

export default function DuesPage() {
  return <Suspense><DuesScreen /></Suspense>;
}
