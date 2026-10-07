import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import type { PaginationMeta, SubscriptionSummary } from '@mess/shared';
import { Button } from '@/components/button';
import { Card } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { StatusPill } from '@/components/subscription-card';
import { AppText } from '@/components/text';
import { apiEnvelope, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { colors, spacing } from '@/theme/tokens';

const PAGE_SIZE = 20;

function HistoryItem({ sub }: { sub: SubscriptionSummary }) {
  return (
    <Card>
      <View style={styles.row}>
        <AppText variant="label" style={styles.flex}>
          {sub.plan.name}
        </AppText>
        <StatusPill status={sub.status} />
      </View>
      <AppText muted>
        {formatDate(sub.startDate)} – {formatDate(sub.endDate)}
      </AppText>
      {sub.totalMealCredits !== null && (
        <AppText variant="caption" muted>
          {sub.remainingMealCredits} of {sub.totalMealCredits} meals left
        </AppText>
      )}
    </Card>
  );
}

/** The student's own subscriptions, newest first. */
export default function PlanHistoryScreen() {
  const [items, setItems] = useState<SubscriptionSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiEnvelope<SubscriptionSummary[]>(`/students/me/subscriptions?page=${page}&pageSize=${PAGE_SIZE}`);
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

  if (!meta && loading) return <FullScreenLoader />;
  if (!meta && error) return <ErrorState title="Couldn't load your plans" description={error} onRetry={() => load(1)} />;

  const hasMore = !!meta && meta.page < meta.totalPages;
  return (
    <FlatList
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <HistoryItem sub={item} />}
      refreshing={loading && meta?.page === 1}
      onRefresh={() => load(1)}
      ListEmptyComponent={<EmptyState icon="time-outline" title="No previous subscriptions." description="Plans your mess assigns will show here." />}
      ListFooterComponent={
        hasMore ? (
          loading ? <ActivityIndicator color={colors.brand600} /> : <Button title="Load more" variant="secondary" onPress={() => load(meta!.page + 1)} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
