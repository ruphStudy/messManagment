import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AttendanceStatus, MEAL_LABELS, type PaginationMeta, type StudentAttendanceItem } from '@mess/shared';
import { Button } from '@/components/button';
import { Card } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { apiEnvelope, errorMessage } from '@/lib/api';
import { menuDayLabel } from '@/lib/use-student-menu';
import { colors, spacing } from '@/theme/tokens';

const PAGE_SIZE = 30;
const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

function Row({ item }: { item: StudentAttendanceItem }) {
  const reversed = item.status === AttendanceStatus.REVERSED;
  return (
    <Card style={styles.row}>
      <Ionicons name={reversed ? 'arrow-undo-outline' : 'checkmark-circle'} size={22} color={reversed ? colors.placeholder : colors.success} />
      <View style={styles.flex}>
        <AppText variant="label" style={reversed && { textDecorationLine: 'line-through', color: colors.inkMuted }}>
          {MEAL_LABELS[item.mealType]} · {menuDayLabel(item.date)}
        </AppText>
        <AppText variant="caption" muted>
          {reversed ? 'Cancelled by mess — not counted' : `Served at ${timeFormat.format(new Date(item.servedAt))}`} · {item.planName}
        </AppText>
      </View>
    </Card>
  );
}

/** The student's own meals, newest first. Reversed entries are shown as not counted. */
export default function AttendanceHistoryScreen() {
  const [items, setItems] = useState<StudentAttendanceItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiEnvelope<StudentAttendanceItem[]>(`/students/me/attendance?page=${page}&pageSize=${PAGE_SIZE}`);
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
  if (!meta && error) return <ErrorState title="Couldn't load meal history" description={error} onRetry={() => load(1)} />;

  const hasMore = !!meta && meta.page < meta.totalPages;
  return (
    <FlatList
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => <Row item={item} />}
      refreshing={loading && meta?.page === 1}
      onRefresh={() => load(1)}
      ListHeaderComponent={items.length ? <Button title="Rate a recent meal" variant="ghost" onPress={() => router.push('/rate-meal')} /> : null}
      ListEmptyComponent={<EmptyState icon="time-outline" title="No meals recorded yet." description="Meals you take at the mess will appear here." />}
      ListFooterComponent={
        hasMore ? (loading ? <ActivityIndicator color={colors.brand600} /> : <Button title="Load more" variant="secondary" onPress={() => load(meta!.page + 1)} />) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.xl, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
