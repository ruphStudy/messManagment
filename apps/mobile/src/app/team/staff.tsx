import { router } from 'expo-router';
import { Permission, ROLE_LABELS, STAFF_STATUS_LABELS, type StaffListItem } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { ListItem, Pill } from '@/components/team/kit';
import { useCan, useLoadMore } from '@/lib/team';

/** The mess team. Owner manages managers + staff; a manager manages staff only (API-enforced hierarchy). */
export default function StaffScreen() {
  const can = useCan();
  const { items, meta, error, loading, load, hasMore } = useLoadMore<StaffListItem>('/staff');
  if (!can(Permission.STAFF_VIEW)) return <EmptyState title="Not available for your role" />;
  if (!meta && error) return <ErrorState title="Couldn't load the team" description={error} onRetry={() => load(1)} />;
  if (!meta) return <FullScreenLoader />;
  return (
    <Screen edges={[]} onRefresh={() => load(1)} refreshing={loading && meta.page === 1}>
      {can(Permission.STAFF_MANAGE) && <Button title="Add staff" onPress={() => router.push('/team/staff-form')} />}
      {items.length <= 1 && <EmptyState icon="people-circle-outline" title="No staff members added yet." />}
      {items.map((m) => (
        <ListItem
          key={m.id}
          avatar={[m.firstName, m.lastName].filter(Boolean).join(' ')}
          title={`${[m.firstName, m.lastName].filter(Boolean).join(' ')}${m.isSelf ? ' (you)' : ''}`}
          subtitle={`${ROLE_LABELS[m.role]} · ${m.mobile}`}
          right={m.status !== 'ACTIVE' ? <Pill label={STAFF_STATUS_LABELS[m.status]} /> : undefined}
          onPress={() => router.push({ pathname: '/team/staff-member', params: { id: m.id } })}
        />
      ))}
      {hasMore && <Button title="Load more" variant="secondary" loading={loading} onPress={() => load(meta.page + 1)} />}
    </Screen>
  );
}
