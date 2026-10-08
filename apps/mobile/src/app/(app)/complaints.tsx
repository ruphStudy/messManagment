import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COMPLAINT_CATEGORY_LABELS, type ComplaintSummaryItem, type PaginationMeta } from '@mess/shared';
import { Button } from '@/components/button';
import { ComplaintStatusPill } from '@/components/complaint-status-pill';
import { Card } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { apiEnvelope, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { colors, spacing } from '@/theme/tokens';

/** The student's complaints, newest first. Reloads whenever the screen is opened (replies show up). */
export default function ComplaintsScreen() {
  const [items, setItems] = useState<ComplaintSummaryItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiEnvelope<ComplaintSummaryItem[]>(`/students/me/complaints?page=${page}&pageSize=20`);
      setItems((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
      setMeta(res.meta ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(1), [load]));

  if (!meta && loading) return <FullScreenLoader />;
  if (!meta && error) return <ErrorState title="Couldn't load complaints" description={error} onRetry={() => load(1)} />;
  const hasMore = !!meta && meta.page < meta.totalPages;

  return (
    <FlatList
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(c) => c.id}
      refreshing={loading && meta?.page === 1}
      onRefresh={() => load(1)}
      ListHeaderComponent={<Button title="Raise a complaint" onPress={() => router.push('/complaint-new')} />}
      renderItem={({ item: c }) => (
        <Pressable onPress={() => router.push({ pathname: '/complaint', params: { id: c.id } })} accessibilityRole="button">
          <Card>
            <View style={styles.row}>
              <AppText variant="label" style={{ flex: 1 }}>{COMPLAINT_CATEGORY_LABELS[c.category]}</AppText>
              <ComplaintStatusPill status={c.status} />
            </View>
            <AppText numberOfLines={2}>{c.description}</AppText>
            <View style={styles.row}>
              <AppText variant="caption" muted style={{ flex: 1 }}>
                {formatDate(c.createdAt.slice(0, 10))}{c.responseCount ? ` · ${c.responseCount} ${c.responseCount === 1 ? 'reply' : 'replies'}` : ''}
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
            </View>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={<EmptyState icon="chatbubble-ellipses-outline" title="You haven't raised any complaints." />}
      ListFooterComponent={hasMore ? (loading ? <ActivityIndicator color={colors.brand600} /> : <Button title="Load more" variant="secondary" onPress={() => load(meta!.page + 1)} />) : null}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
