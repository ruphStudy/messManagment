import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { addDays, MEAL_KEYS, MEAL_LABELS, MENU_LIMITS, type DailyMenu, type DailyMenuInput, type MealKey, type MenuDay } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { FullScreenLoader } from '@/components/states';
import { MultilineInput, Pill } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { menuDayLabel } from '@/lib/use-student-menu';
import { confirm, mutate } from '@/lib/team';
import { colors } from '@/theme/tokens';

type Draft = Record<MealKey, { available: boolean; items: string; note: string }> & { generalNote: string };

const toDraft = (m: DailyMenu | null): Draft => ({
  ...(Object.fromEntries(MEAL_KEYS.map((k) => [k, { available: m ? m[k].available : true, items: m ? m[k].items.join('\n') : '', note: m?.[k].note ?? '' }])) as Record<MealKey, Draft[MealKey]>),
  generalNote: m?.generalNote ?? '',
});
/** One item per line (or comma separated); the API trims and de-duplicates. */
const toInput = (d: Draft): DailyMenuInput => ({
  ...(Object.fromEntries(MEAL_KEYS.map((k) => [k, { available: d[k].available, items: d[k].items.split(/[\n,]/).map((i) => i.trim()).filter(Boolean), note: d[k].note.trim() || null }])) as Record<MealKey, DailyMenuInput[MealKey]>),
  generalNote: d.generalNote.trim() || null,
});

/** Create/edit one day's menu: save draft, publish/unpublish, copy from the previous day. */
export default function MenuEditScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const toast = useToast();
  const [menu, setMenu] = useState<DailyMenu | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const [busy, setBusy] = useState(false);
  const load = () => api<MenuDay>(`/menus/${date}`).then((d) => { setMenu(d.menu); setDraft(toDraft(d.menu)); }).catch((e: unknown) => toast.show(errorMessage(e), 'error'));
  useEffect(() => void load(), [date]); // eslint-disable-line react-hooks/exhaustive-deps
  if (menu === undefined) return <FullScreenLoader />;

  const run = async (fn: () => Promise<DailyMenu>, done: string) => {
    setBusy(true);
    const res = await mutate(fn, toast, done);
    if (res) { setMenu(res); setDraft(toDraft(res)); }
    setBusy(false);
  };
  const save = () => run(() => api<DailyMenu>(`/menus/${date}`, { method: 'PUT', body: toInput(draft) }), menu?.isPublished ? 'Saved (published menu updated)' : 'Draft saved');
  const setMeal = (k: MealKey, patch: Partial<Draft[MealKey]>) => setDraft((d) => ({ ...d, [k]: { ...d[k], ...patch } }));

  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText variant="title" style={{ flex: 1 }}>{menuDayLabel(date)}</AppText>
        <Pill label={!menu ? 'New' : menu.isPublished ? 'Published' : 'Draft'} tone={menu?.isPublished ? 'success' : 'brand'} />
      </View>
      {MEAL_KEYS.map((k) => (
        <Card key={k}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppText variant="label" style={{ flex: 1 }}>{MEAL_LABELS[k]}</AppText>
            <AppText variant="caption" muted>Served</AppText>
            <Switch value={draft[k].available} onValueChange={(v) => setMeal(k, { available: v })} trackColor={{ true: colors.brand500 }} accessibilityLabel={`${MEAL_LABELS[k]} served`} />
          </View>
          {draft[k].available && <MultilineInput value={draft[k].items} onChange={(t) => setMeal(k, { items: t })} placeholder={`Items, one per line (max ${MENU_LIMITS.itemsPerMeal})`} />}
          <TextField label="Note (optional)" value={draft[k].note} maxLength={MENU_LIMITS.mealNoteLength} onChangeText={(t) => setMeal(k, { note: t })} />
        </Card>
      ))}
      <TextField label="General note (optional)" value={draft.generalNote} maxLength={MENU_LIMITS.generalNoteLength} onChangeText={(t) => setDraft((d) => ({ ...d, generalNote: t }))} />
      <Button title={menu?.isPublished ? 'Save changes' : 'Save draft'} onPress={save} loading={busy} />
      {menu && (
        <Button
          title={menu.isPublished ? 'Unpublish' : 'Publish to students'}
          variant={menu.isPublished ? 'secondary' : 'primary'}
          loading={busy}
          onPress={() =>
            menu.isPublished
              ? confirm('Unpublish menu?', 'Students will no longer see this day.', 'Unpublish', () => void run(() => api<DailyMenu>(`/menus/${date}/unpublish`, { method: 'POST' }), 'Unpublished'))
              : void run(() => api<DailyMenu>(`/menus/${date}/publish`, { method: 'POST' }), 'Published')
          }
        />
      )}
      <Button
        title="Copy from previous day"
        variant="ghost"
        onPress={() =>
          confirm('Copy previous day?', menu ? "This replaces this day's menu with a draft copy." : 'Creates a draft copy of the previous day.', 'Copy', () =>
            void run(() => api<DailyMenu>(`/menus/${date}/copy-from`, { method: 'POST', body: { sourceDate: addDays(date, -1), replace: !!menu } }), 'Copied as draft'),
          )
        }
      />
    </Screen>
  );
}
