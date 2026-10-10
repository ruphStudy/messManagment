import type { AppNotification } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { ListItem } from '@/components/team/kit';
import { api } from '@/lib/api';
import { openNotificationTarget, useNotifications } from '@/lib/notifications';
import { useLoadMore } from '@/lib/team';

const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** The signed-in team member's own notifications; opening one marks it read and goes to its screen. */
export default function TeamNotificationsScreen() {
  const { refresh, markRead } = useNotifications();
  const { items, setItems, meta, error, loading, load, hasMore } = useLoadMore<AppNotification>('/notifications');
  const open = (n: AppNotification) => {
    if (!n.readAt) {
      setItems((all) => all.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      void markRead(n.id);
    }
    openNotificationTarget(n.data);
  };
  const readAll = async () => {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    setItems((all) => all.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    void refresh();
  };
  if (!meta && error) return <ErrorState title="Couldn't load notifications" description={error} onRetry={() => load(1)} />;
  if (!meta) return <FullScreenLoader />;
  return (
    <Screen edges={[]} onRefresh={() => { void load(1); void refresh(); }} refreshing={loading && meta.page === 1}>
      {items.some((n) => !n.readAt) && <Button title="Mark all as read" variant="ghost" onPress={readAll} />}
      {!items.length ? <EmptyState icon="notifications-outline" title="No notifications yet." /> : items.map((n) => (
        <ListItem key={n.id} icon={n.readAt ? 'notifications-outline' : 'notifications'} title={`${n.readAt ? '' : '● '}${n.title}`} subtitle={`${n.body} · ${when.format(new Date(n.createdAt))}`} onPress={() => open(n)} />
      ))}
      {hasMore && <Button title="Load more" variant="secondary" loading={loading} onPress={() => load(meta.page + 1)} />}
    </Screen>
  );
}
