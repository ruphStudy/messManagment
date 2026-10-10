import { useState } from 'react';
import { router } from 'expo-router';
import { formatPaise, Permission, SUBSCRIPTION_STATUS_LABELS, type DueItem, type ReminderResult } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { ListItem, SearchBar } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { useDebounced } from '@/components/team/use-debounced';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { confirm, mutate, useCan, useLoadMore } from '@/lib/team';

/** Who still owes money; tap to record a payment; owner/manager can remind everyone with dues. */
export default function DuesScreen() {
  const can = useCan();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 350);
  const list = useLoadMore<DueItem>(`/payments/dues${q ? `?search=${encodeURIComponent(q)}` : ''}`);
  if (!can(Permission.FINANCE_VIEW)) return <EmptyState title="Not available for your role" />;
  const remindAll = () =>
    confirm('Send payment reminders?', 'Everyone with pending dues who uses the app gets a reminder (recently reminded students are skipped).', 'Send', () =>
      void mutate(() => api<ReminderResult>('/reminders/payment-due/bulk', { method: 'POST', body: { allWithDues: true } }), toast).then((r) => r && toast.show(`${r.sent.length} sent, ${r.skipped.length + r.failed.length} skipped`, 'success')),
    );
  return (
    <Screen edges={[]} onRefresh={() => list.load(1)} refreshing={list.loading && list.meta?.page === 1}>
      <SuspendedBanner />
      {can(Permission.REMINDER_SEND) && <Button title="Remind all with dues" variant="secondary" onPress={remindAll} />}
      <SearchBar value={search} onChange={setSearch} placeholder="Search student" />
      {!list.meta && list.error ? (
        <ErrorState title="Couldn't load dues" description={list.error} onRetry={() => list.load(1)} />
      ) : !list.meta ? (
        <FullScreenLoader />
      ) : !list.items.length ? (
        <EmptyState icon="wallet-outline" title="Nobody has pending dues." />
      ) : (
        <>
          {list.items.map((d) => (
            <ListItem
              key={d.subscriptionId}
              avatar={[d.student.firstName, d.student.lastName].filter(Boolean).join(' ')}
              title={`${formatPaise(d.payment.duePaise)} · ${[d.student.firstName, d.student.lastName].filter(Boolean).join(' ')}`}
              subtitle={`${d.planName} · ${SUBSCRIPTION_STATUS_LABELS[d.subscriptionStatus]} · paid ${formatPaise(d.payment.paidPaise)} of ${formatPaise(d.payment.payablePaise)}`}
              onPress={can(Permission.PAYMENT_RECORD) ? () => router.push({ pathname: '/team/payment-new', params: { studentId: d.student.id, subscriptionId: d.subscriptionId } }) : undefined}
            />
          ))}
          {list.hasMore && <Button title="Load more" variant="secondary" loading={list.loading} onPress={() => list.load(list.meta!.page + 1)} />}
        </>
      )}
    </Screen>
  );
}
