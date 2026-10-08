'use client';

import { Suspense, useMemo, useState } from 'react';
import { CheckCircle2, SearchX } from 'lucide-react';
import { can, Permission, SubscriptionStatus, type DueItem } from '@mess/shared';
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
      {error ? (
        <ErrorState title="Couldn't load dues" description={error} onRetry={retry} />
      ) : !result ? (
        <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</Card>
      ) : result.data.length === 0 ? (
        search || status ? <EmptyState icon={SearchX} title="No dues match your filters." /> : <EmptyState icon={CheckCircle2} title="No pending dues." description="Every subscription is fully paid." />
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
        onDone={() => { setRecording(null); retry(); }}
      />
    </>
  );
}

export default function DuesPage() {
  return <Suspense><DuesScreen /></Suspense>;
}
