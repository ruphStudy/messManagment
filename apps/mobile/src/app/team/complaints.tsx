import { useState } from 'react';
import { router } from 'expo-router';
import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS, ComplaintStatus, type ComplaintCounts, type ComplaintListItem } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, ListItem, Pill } from '@/components/team/kit';
import { formatDate } from '@/lib/student-profile';
import { useApi, useLoadMore } from '@/lib/team';

const TONE = { OPEN: 'danger', IN_PROGRESS: 'brand', RESOLVED: 'success' } as const;

export default function TeamComplaintsScreen() {
  const [status, setStatus] = useState<ComplaintStatus | ''>(ComplaintStatus.OPEN);
  const counts = useApi<ComplaintCounts>('/complaints/counts');
  const list = useLoadMore<ComplaintListItem>(`/complaints${status ? `?status=${status}` : ''}`);
  return (
    <Screen edges={[]} onRefresh={() => { void list.load(1); void counts.reload(); }} refreshing={list.loading && list.meta?.page === 1}>
      <Chips
        options={[
          ...Object.values(ComplaintStatus).map((s) => ({ value: s, label: `${COMPLAINT_STATUS_LABELS[s]}${counts.data ? ` (${counts.data[s]})` : ''}` })),
          { value: '' as const, label: 'All' },
        ]}
        value={status}
        onChange={(v) => setStatus(v as ComplaintStatus | '')}
      />
      {!list.meta && list.error ? (
        <ErrorState title="Couldn't load complaints" description={list.error} onRetry={() => list.load(1)} />
      ) : !list.meta ? (
        <FullScreenLoader />
      ) : !list.items.length ? (
        <EmptyState icon="chatbubble-ellipses-outline" title={status === ComplaintStatus.OPEN ? 'No open complaints.' : 'No complaints here.'} />
      ) : (
        <>
          {list.items.map((c) => (
            <ListItem
              key={c.id}
              avatar={[c.student.firstName, c.student.lastName].filter(Boolean).join(' ')}
              title={`${COMPLAINT_CATEGORY_LABELS[c.category]} · ${[c.student.firstName, c.student.lastName].filter(Boolean).join(' ')}`}
              subtitle={`${formatDate(c.createdAt.slice(0, 10))} · ${c.description.slice(0, 80)}${c.responseCount ? ` · ${c.responseCount} replies` : ''}`}
              right={<Pill label={COMPLAINT_STATUS_LABELS[c.status]} tone={TONE[c.status]} />}
              onPress={() => router.push({ pathname: '/team/complaint', params: { id: c.id } })}
            />
          ))}
          {list.hasMore && <Button title="Load more" variant="secondary" loading={list.loading} onPress={() => list.load(list.meta!.page + 1)} />}
        </>
      )}
    </Screen>
  );
}
