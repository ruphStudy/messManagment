import { useState } from 'react';
import { router } from 'expo-router';
import { formatPaise, PAYMENT_METHOD_LABELS, Permission, PaymentTransactionStatus, type PaymentDashboardSummary, type PaymentRecord } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { ListItem, SearchBar, Stats } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { useDebounced } from '@/components/team/use-debounced';
import { formatDate } from '@/lib/student-profile';
import { useApi, useCan, useLoadMore } from '@/lib/team';

export default function PaymentsScreen() {
  const can = useCan();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 350);
  const summary = useApi<PaymentDashboardSummary>('/payments/summary');
  const list = useLoadMore<PaymentRecord>(`/payments${q ? `?search=${encodeURIComponent(q)}` : ''}`);
  if (!can(Permission.FINANCE_VIEW)) return <EmptyState title="Not available for your role" />;
  return (
    <Screen edges={[]} onRefresh={() => { void list.load(1); void summary.reload(); }} refreshing={list.loading && list.meta?.page === 1}>
      <SuspendedBanner />
      {can(Permission.PAYMENT_RECORD) && <Button title="Record payment" onPress={() => router.push('/team/payment-new')} />}
      {summary.data && (
        <Card>
          <Stats
            items={[
              { label: 'Collected today', value: formatPaise(summary.data.collectedTodayPaise) },
              { label: 'This month', value: formatPaise(summary.data.collectedThisMonthPaise) },
              { label: 'Pending dues', value: formatPaise(summary.data.pendingDuesPaise), tone: summary.data.pendingDuesPaise ? 'danger' : undefined },
              { label: 'Students owing', value: summary.data.studentsWithDues },
            ]}
          />
          <Button title="View pending dues" variant="ghost" onPress={() => router.push('/team/dues')} />
        </Card>
      )}
      <SearchBar value={search} onChange={setSearch} placeholder="Search student, receipt, reference" />
      {!list.meta && list.error ? (
        <ErrorState title="Couldn't load payments" description={list.error} onRetry={() => list.load(1)} />
      ) : !list.meta ? (
        <FullScreenLoader />
      ) : !list.items.length ? (
        <EmptyState icon="cash-outline" title={q ? 'No payments match.' : 'No payments yet.'} />
      ) : (
        <>
          {list.items.map((p) => (
            <ListItem
              key={p.id}
              muted={p.status === PaymentTransactionStatus.REVERSED}
              avatar={[p.student.firstName, p.student.lastName].filter(Boolean).join(' ')}
              title={`${formatPaise(p.amountPaise)} · ${[p.student.firstName, p.student.lastName].filter(Boolean).join(' ')}`}
              subtitle={`${formatDate(p.paymentDate)} · ${PAYMENT_METHOD_LABELS[p.method]} · ${p.receiptNumber}${p.status === PaymentTransactionStatus.REVERSED ? ' · Reversed' : ''}`}
              onPress={() => router.push({ pathname: '/team/receipt', params: { id: p.id } })}
            />
          ))}
          {list.hasMore && <Button title="Load more" variant="secondary" loading={list.loading} onPress={() => list.load(list.meta!.page + 1)} />}
        </>
      )}
    </Screen>
  );
}
