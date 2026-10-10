import { useState } from 'react';
import { router } from 'expo-router';
import { addDays, businessToday, MEAL_KEYS, MEAL_LABELS, Permission, type ExpectedMeals, type MealType, type PauseRecord } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, ListItem, Stats } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { menuDayLabel } from '@/lib/use-student-menu';
import { confirm, mutate, useApi, useCan, useLoadMore } from '@/lib/team';

/** Who paused which meal (today / tomorrow / next 7 days) with expected counts; cancel where allowed. */
export default function PausesScreen() {
  const can = useCan();
  const toast = useToast();
  const today = businessToday();
  const [day, setDay] = useState<'today' | 'tomorrow' | 'week'>('tomorrow');
  const [meal, setMeal] = useState<MealType | ''>('');
  const from = day === 'tomorrow' ? addDays(today, 1) : today;
  const to = day === 'week' ? addDays(today, 6) : from;
  const expected = useApi<ExpectedMeals>(`/attendance/expected?date=${from}`);
  const list = useLoadMore<PauseRecord>(`/pauses?from=${from}&to=${to}&status=ACTIVE${meal ? `&mealType=${meal}` : ''}`, 50);
  const cancel = (p: PauseRecord) =>
    confirm('Cancel this pause?', `${p.student.firstName} will be expected for ${MEAL_LABELS[p.mealType].toLowerCase()} on ${menuDayLabel(p.date)}.`, 'Cancel pause', () =>
      void mutate(() => api(`/pauses/${p.id}/cancel`, { method: 'POST' }), toast, 'Pause cancelled').then(() => { void list.load(1); void expected.reload(); }),
    );
  return (
    <Screen edges={[]} onRefresh={() => { void list.load(1); void expected.reload(); }} refreshing={list.loading && list.meta?.page === 1}>
      <SuspendedBanner />
      {can(Permission.PAUSE_MANAGE) && <Button title="Add pause for a student" onPress={() => router.push('/team/pause-new')} />}
      <Chips options={[{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'week', label: 'Next 7 days' }]} value={day} onChange={setDay} />
      {expected.data && day !== 'week' && (
        <Card>
          <AppText variant="label">{menuDayLabel(from)} — expected (paused)</AppText>
          <Stats items={MEAL_KEYS.map((k) => ({ label: MEAL_LABELS[k], value: `${expected.data!.meals[k].expected} (${expected.data!.meals[k].paused})` }))} />
        </Card>
      )}
      <Chips options={[{ value: '', label: 'All meals' }, ...MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))]} value={meal} onChange={(v) => setMeal(v as MealType | '')} />
      {!list.meta && list.error ? (
        <ErrorState title="Couldn't load pauses" description={list.error} onRetry={() => list.load(1)} />
      ) : !list.meta ? (
        <FullScreenLoader />
      ) : !list.items.length ? (
        <EmptyState icon="pause-circle-outline" title="No meals paused." />
      ) : (
        <>
          {list.items.map((p) => (
            <ListItem
              key={p.id}
              avatar={[p.student.firstName, p.student.lastName].filter(Boolean).join(' ')}
              title={`${[p.student.firstName, p.student.lastName].filter(Boolean).join(' ')} · ${MEAL_LABELS[p.mealType]}`}
              subtitle={[menuDayLabel(p.date), p.reason, p.source === 'STUDENT' ? 'by student' : p.createdBy && `by ${p.createdBy}`].filter(Boolean).join(' · ')}
              right={p.canCancel && can(Permission.PAUSE_MANAGE) ? <Button title="Cancel" variant="ghost" onPress={() => cancel(p)} /> : undefined}
            />
          ))}
          {list.hasMore && <Button title="Load more" variant="secondary" loading={list.loading} onPress={() => list.load(list.meta!.page + 1)} />}
        </>
      )}
    </Screen>
  );
}
