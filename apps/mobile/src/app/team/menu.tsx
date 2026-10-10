import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { addDays, businessToday, MEAL_KEYS, MEAL_LABELS, Permission, startOfWeek, type CopyWeekResult, type MenuDay } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, Pill } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { menuDayLabel } from '@/lib/use-student-menu';
import { confirm, mutate, useApi, useCan } from '@/lib/team';

type Range = 'today' | 'tomorrow' | 'week';

/** Menus by day (drafts included). Owner/manager can edit/publish; staff read only. */
export default function TeamMenuScreen() {
  const can = useCan();
  const toast = useToast();
  const editable = can(Permission.MENU_MANAGE);
  const [range, setRange] = useState<Range>('today');
  const today = businessToday();
  const from = range === 'tomorrow' ? addDays(today, 1) : range === 'week' ? startOfWeek(today) : today;
  const to = range === 'week' ? addDays(from, 6) : from;
  const { data, error, loading, reload } = useApi<MenuDay[]>(`/menus?from=${from}&to=${to}`);

  const copyLastWeek = () =>
    confirm('Copy last week?', "Copies last week's menus into empty days of this week as drafts.", 'Copy', () =>
      void mutate(() => api<CopyWeekResult>('/menus/copy-week', { method: 'POST', body: { weekStart: from } }), toast, 'Copied as drafts').then(() => reload()),
    );

  return (
    <Screen edges={[]} onRefresh={reload} refreshing={loading}>
      <SuspendedBanner />
      <Chips options={[{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'week', label: 'This week' }]} value={range} onChange={setRange} />
      {error && !data ? (
        <ErrorState title="Couldn't load menus" description={error} onRetry={reload} />
      ) : !data ? (
        <FullScreenLoader />
      ) : (
        data.map((d) => (
          <Card key={d.date}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="label" style={{ flex: 1 }}>{menuDayLabel(d.date)}</AppText>
              <Pill label={!d.menu ? 'Not created' : d.menu.isPublished ? 'Published' : 'Draft'} tone={!d.menu ? 'neutral' : d.menu.isPublished ? 'success' : 'brand'} />
            </View>
            {d.menu &&
              MEAL_KEYS.map((k) => (
                <AppText key={k} numberOfLines={2}>
                  <AppText muted>{MEAL_LABELS[k]}: </AppText>
                  {!d.menu![k].available ? 'Not served' : d.menu![k].items.join(', ') || '—'}
                </AppText>
              ))}
            {d.menu?.generalNote && <AppText variant="caption" muted>{d.menu.generalNote}</AppText>}
            {editable && <Button title={d.menu ? 'Edit' : 'Create menu'} variant="secondary" onPress={() => router.push({ pathname: '/team/menu-edit', params: { date: d.date } })} />}
          </Card>
        ))
      )}
      {editable && range === 'week' && <Button title="Copy last week into this week" variant="ghost" onPress={copyLastWeek} />}
    </Screen>
  );
}
