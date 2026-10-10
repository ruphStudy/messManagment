import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AttendanceStatus, businessToday, MEAL_KEYS, MEAL_LABELS, Permission, type AttendanceRecord, type ExpectedMeals, type MealType } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, ListItem, SearchBar, Stats } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { useDebounced } from '@/components/team/use-debounced';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { confirm, mutate, useApi, useCan, useLoadMore } from '@/lib/team';

const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

/** Today's counts + served list; scan and manual entry; owner/manager can reverse a meal. */
export default function AttendanceScreen() {
  const can = useCan();
  const toast = useToast();
  const today = businessToday();
  const [meal, setMeal] = useState<MealType | ''>('');
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 350);
  const expected = useApi<ExpectedMeals>(`/attendance/expected?date=${today}`);
  const list = useLoadMore<AttendanceRecord>(`/attendance?date=${today}${meal ? `&mealType=${meal}` : ''}${status ? `&status=${status}` : ''}${q ? `&search=${encodeURIComponent(q)}` : ''}`, 30);

  const reverse = (a: AttendanceRecord) =>
    confirm(`Reverse ${MEAL_LABELS[a.mealType].toLowerCase()}?`, `${a.student.firstName}'s meal is cancelled and any meal credit is returned.`, 'Reverse', () =>
      void mutate(() => api(`/attendance/${a.id}/reverse`, { method: 'POST', body: {} }), toast, 'Meal reversed').then(() => { void list.load(1); void expected.reload(); }),
    true);

  return (
    <Screen edges={[]} onRefresh={() => { void list.load(1); void expected.reload(); }} refreshing={list.loading && list.meta?.page === 1}>
      <SuspendedBanner />
      {can(Permission.ATTENDANCE_MARK) && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Scan QR" onPress={() => router.push('/team/scan')} /></View>
          <View style={{ flex: 1 }}><Button title="Manual" variant="secondary" onPress={() => router.push('/team/manual')} /></View>
        </View>
      )}
      {expected.data && (
        <Card>
          <AppText variant="label">Today</AppText>
          <Stats items={MEAL_KEYS.map((k) => ({ label: `${MEAL_LABELS[k]} served / expected`, value: `${expected.data!.meals[k].served} / ${expected.data!.meals[k].expected}` }))} />
          <AppText variant="caption" muted>{MEAL_KEYS.map((k) => `${MEAL_LABELS[k]}: ${expected.data!.meals[k].remaining} left, ${expected.data!.meals[k].paused} paused`).join(' · ')}</AppText>
        </Card>
      )}
      <SearchBar value={search} onChange={setSearch} placeholder="Search student" />
      <Chips options={[{ value: '', label: 'All meals' }, ...MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))]} value={meal} onChange={(v) => setMeal(v as MealType | '')} />
      <Chips options={[{ value: '', label: 'All' }, { value: AttendanceStatus.SERVED, label: 'Served' }, { value: AttendanceStatus.REVERSED, label: 'Reversed' }]} value={status} onChange={(v) => setStatus(v as AttendanceStatus | '')} />
      {!list.meta && list.error ? (
        <ErrorState title="Couldn't load attendance" description={list.error} onRetry={() => list.load(1)} />
      ) : !list.meta ? (
        <FullScreenLoader />
      ) : !list.items.length ? (
        <EmptyState icon="checkmark-done-outline" title="No meals served yet today." />
      ) : (
        <>
          {list.items.map((a) => {
            const reversed = a.status === AttendanceStatus.REVERSED;
            return (
              <ListItem
                key={a.id}
                muted={reversed}
                avatar={[a.student.firstName, a.student.lastName].filter(Boolean).join(' ')}
                title={`${[a.student.firstName, a.student.lastName].filter(Boolean).join(' ')} · ${MEAL_LABELS[a.mealType]}`}
                subtitle={`${reversed ? 'Reversed' : `Served ${time.format(new Date(a.servedAt))}`} · ${a.source === 'QR' ? 'QR' : 'Manual'}${a.servedBy ? ` · ${a.servedBy}` : ''}`}
                right={!reversed && can(Permission.ATTENDANCE_REVERSE) ? <Button title="Reverse" variant="ghost" onPress={() => reverse(a)} /> : undefined}
              />
            );
          })}
          {list.hasMore && <Button title="Load more" variant="secondary" loading={list.loading} onPress={() => list.load(list.meta!.page + 1)} />}
        </>
      )}
    </Screen>
  );
}
