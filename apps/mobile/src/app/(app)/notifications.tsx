import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationType, type AppNotification, type PaginationMeta } from '@mess/shared';
import { Button } from '@/components/button';
import { Card } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { api, apiEnvelope, errorMessage } from '@/lib/api';
import { openNotificationTarget, useNotifications } from '@/lib/notifications';
import { colors, spacing, TOUCH_TARGET } from '@/theme/tokens';

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  PAYMENT_DUE: 'wallet-outline',
  SUBSCRIPTION_EXPIRING: 'time-outline',
  SUBSCRIPTION_EXPIRED: 'time-outline',
  MENU_CHANGED: 'restaurant-outline',
  MEAL_PAUSE_CREATED: 'pause-circle-outline',
  MEAL_PAUSE_CANCELLED: 'play-circle-outline',
  MANUAL_REMINDER: 'megaphone-outline',
  SYSTEM: 'information-circle-outline',
};
const timeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const PAGE_SIZE = 20;

/** Notification center. Opening a notification marks it read and goes to its screen (if it has one). */
export default function NotificationsScreen() {
  const { refresh, markRead } = useNotifications();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiEnvelope<AppNotification[]>(`/notifications?page=${page}&pageSize=${PAGE_SIZE}`);
      setItems((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
      setMeta(res.meta ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(1);
  }, [load]);

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

  if (!meta && loading) return <FullScreenLoader />;
  if (!meta && error) return <ErrorState title="Couldn't load notifications" description={error} onRetry={() => load(1)} />;

  const hasMore = !!meta && meta.page < meta.totalPages;
  return (
    <FlatList
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(n) => n.id}
      refreshing={loading && meta?.page === 1}
      onRefresh={() => {
        void load(1);
        void refresh();
      }}
      ListHeaderComponent={items.some((n) => !n.readAt) ? <Button title="Mark all as read" variant="ghost" onPress={readAll} /> : null}
      renderItem={({ item: n }) => (
        <Pressable onPress={() => open(n)} accessibilityRole="button" accessibilityLabel={`${n.readAt ? '' : 'Unread. '}${n.title}`}>
          <Card style={[styles.row, !n.readAt && styles.unread]}>
            <Ionicons name={ICONS[n.type]} size={22} color={n.readAt ? colors.inkMuted : colors.brand600} />
            <View style={styles.flex}>
              <AppText variant="label" style={!n.readAt && { fontWeight: '700' }}>{n.title}</AppText>
              <AppText muted>{n.body}</AppText>
              <AppText variant="caption" muted>{timeFormat.format(new Date(n.createdAt))}</AppText>
            </View>
            {!n.readAt && <View style={styles.dot} />}
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={<EmptyState icon="notifications-outline" title="No notifications yet." />}
      ListFooterComponent={hasMore ? (loading ? <ActivityIndicator color={colors.brand600} /> : <Button title="Load more" variant="secondary" onPress={() => load(meta!.page + 1)} />) : null}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: TOUCH_TARGET },
  unread: { borderColor: colors.brand100, backgroundColor: colors.brand50 },
  flex: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand600, marginTop: 6 },
});
