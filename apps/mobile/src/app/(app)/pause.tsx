import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatTime12h,
  isPauseCutoffPassed,
  MEAL_KEYS,
  MEAL_LABELS,
  PAUSE_REASON_MAX,
  PAUSE_REASON_PRESETS,
  StudentPauseView,
  type CreatePauseResult,
  type MealType,
  type StudentPauseItem,
  type StudentPauseSettings,
} from '@mess/shared';
import { Button } from '@/components/button';
import { DateRangeGrid } from '@/components/date-range-grid';
import { Card, Screen } from '@/components/layout';
import { NotLinkedCard } from '@/components/not-linked';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api, apiEnvelope, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePauseSettings } from '@/lib/use-pause-settings';
import { menuDayLabel } from '@/lib/use-student-menu';
import { colors, radius, spacing, TOUCH_TARGET, themed } from '@/theme/tokens';

type Tab = 'new' | 'upcoming' | 'history';
type Settings = Extract<StudentPauseSettings, { linked: true }>;

function Segments({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'new', label: 'Pause meals' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'history', label: 'History' },
  ];
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {tabs.map((t) => (
        <Pressable key={t.key} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: value === t.key }} style={[styles.segment, value === t.key && styles.segmentActive]}>
          <AppText style={[styles.segmentLabel, value === t.key && { color: '#fff' }]}>{t.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.chip, selected && styles.chipOn, disabled && { opacity: 0.4 }]}
    >
      <AppText style={[{ fontWeight: '600' }, selected && { color: '#fff' }]}>{label}</AppText>
    </Pressable>
  );
}

/** New pause: dates, meals (only ones that can actually be paused), optional reason. */
function NewPause({ settings, onCreated }: { settings: Settings; onCreated: () => void }) {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealType[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreatePauseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const offered = MEAL_KEYS.filter((m) => settings.servedMeals[m] || settings.plans.some((p) => p.meals[m]));
  const inRange = (p: Settings['plans'][number]) => !!from && !!to && p.startDate <= to && p.endDate >= from;
  const onlyToday = from === settings.today && to === settings.today;
  /** Why a meal can't be picked for the chosen dates (best effort; the server re-checks everything). */
  const blocked = (m: MealType): string | null => {
    if (!from) return null;
    if (!settings.plans.some((p) => inRange(p) && p.meals[m])) return `${MEAL_LABELS[m]} is not in your plan for these dates.`;
    if (onlyToday && settings.todayMeals[m] === 'SERVED') return 'You already used this meal today.';
    if (onlyToday && settings.todayMeals[m] === 'PAUSED') return `${MEAL_LABELS[m]} is already paused for today.`;
    if (onlyToday && isPauseCutoffPassed(settings.today, settings.cutoffs[m], settings.today, settings.nowTime)) {
      return `${MEAL_LABELS[m]} can no longer be paused for today.`;
    }
    return null;
  };

  useEffect(() => setMeals((cur) => cur.filter((m) => !blocked(m))), [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!from || !to || !meals.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<CreatePauseResult>('/students/me/pauses', {
        method: 'POST',
        body: { fromDate: from, toDate: to, mealTypes: meals, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      });
      setResult(res);
      if (res.created.length) {
        setFrom(null);
        setTo(null);
        setMeals([]);
        setReason('');
        onCreated();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const problems = result ? [...result.skipped, ...result.failed] : [];

  return (
    <View style={{ gap: spacing.lg }}>
      {result && (
        <Card style={{ backgroundColor: result.created.length ? colors.successSoft : colors.canvas }}>
          <AppText variant="label">
            {result.created.length ? `${result.created.length} ${result.created.length === 1 ? 'meal' : 'meals'} paused` : 'No meals were paused'}
          </AppText>
          {problems.map((p) => (
            <AppText key={`${p.date}-${p.mealType}`} variant="caption" muted>
              {menuDayLabel(p.date)} · {p.message}
            </AppText>
          ))}
        </Card>
      )}

      <Card>
        <AppText variant="label">1. Choose days</AppText>
        <AppText variant="caption" muted>
          Tap a day. Tap another day to pause several days.
        </AppText>
        <DateRangeGrid today={settings.today} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setResult(null); }} />
        {from && (
          <AppText style={{ fontWeight: '600' }}>
            {from === to ? menuDayLabel(from) : `${menuDayLabel(from)} → ${menuDayLabel(to!)}`}
          </AppText>
        )}
      </Card>

      <Card>
        <AppText variant="label">2. Choose meals</AppText>
        <View style={styles.chips}>
          {offered.map((m) => (
            <Chip key={m} label={MEAL_LABELS[m]} selected={meals.includes(m)} disabled={!from || !!blocked(m)} onPress={() => setMeals((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))} />
          ))}
        </View>
        {offered.map((m) => {
          const why = blocked(m);
          return (
            <AppText key={m} variant="caption" style={{ color: why ? colors.danger : colors.inkMuted }}>
              {why ?? `${MEAL_LABELS[m]} can be paused for today until ${formatTime12h(settings.cutoffs[m])}.`}
            </AppText>
          );
        })}
      </Card>

      <Card>
        <AppText variant="label">3. Reason (optional)</AppText>
        <View style={styles.chips}>
          {PAUSE_REASON_PRESETS.map((r) => (
            <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(reason === r ? '' : r)} />
          ))}
        </View>
        <TextInput
          value={reason}
          onChangeText={setReason}
          maxLength={PAUSE_REASON_MAX}
          placeholder="Or type a reason"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          accessibilityLabel="Reason"
        />
      </Card>

      {error && <AppText style={{ color: colors.danger }}>{error}</AppText>}
      <Button title="Pause meals" onPress={submit} loading={saving} disabled={!from || !meals.length} />
    </View>
  );
}

/** Pauses grouped by date. Upcoming ones can be resumed (cancelled). */
function PauseList({ view, refreshKey, onChanged }: { view: StudentPauseView; refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<StudentPauseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await apiEnvelope<StudentPauseItem[]>(`/students/me/pauses?view=${view}&pageSize=100`)).data);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [view]);
  useEffect(() => {
    setItems(null);
    void load();
  }, [load, refreshKey]);

  const resume = (p: StudentPauseItem) =>
    Alert.alert(`Resume ${MEAL_LABELS[p.mealType].toLowerCase()}?`, `${menuDayLabel(p.date)} — you will be expected for this meal again.`, [
      { text: 'Keep paused', style: 'cancel' },
      {
        text: 'Resume meal',
        onPress: async () => {
          try {
            await api(`/students/me/pauses/${p.id}/cancel`, { method: 'POST' });
            toast.show(`${MEAL_LABELS[p.mealType]} resumed`, 'success');
            onChanged();
          } catch (e) {
            toast.show(errorMessage(e), 'error');
          }
        },
      },
    ]);

  const groups = useMemo(() => {
    const map = new Map<string, StudentPauseItem[]>();
    for (const p of items ?? []) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return [...map.entries()];
  }, [items]);

  if (error) return <ErrorState title="Couldn't load pauses" description={error} onRetry={load} />;
  if (!items) return <FullScreenLoader />;
  if (!items.length) {
    return <EmptyState icon="pause-circle-outline" title={view === StudentPauseView.UPCOMING ? 'No meals paused.' : 'Nothing here yet.'} />;
  }
  return (
    <View style={{ gap: spacing.md }}>
      {groups.map(([date, list]) => (
        <Card key={date}>
          <AppText variant="label">{menuDayLabel(date)}</AppText>
          {list.map((p) => (
            <View key={p.id} style={styles.pauseRow}>
              <Ionicons name={p.status === 'CANCELLED' ? 'play-circle-outline' : 'pause-circle'} size={20} color={p.status === 'CANCELLED' ? colors.placeholder : colors.brand600} />
              <View style={{ flex: 1 }}>
                <AppText style={p.status === 'CANCELLED' && { color: colors.inkMuted }}>
                  {MEAL_LABELS[p.mealType]} — {p.status === 'CANCELLED' ? 'Resumed' : 'Paused'}
                </AppText>
                {(p.reason || p.source === 'MESS') && (
                  <AppText variant="caption" muted>
                    {[p.reason, p.source === 'MESS' ? 'added by your mess' : null].filter(Boolean).join(' · ')}
                  </AppText>
                )}
              </View>
              {p.canCancel && <Button title="Resume" variant="ghost" onPress={() => resume(p)} style={{ minHeight: TOUCH_TARGET - 8 }} />}
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

export default function PauseScreen() {
  const { session } = useAuth();
  const { data, error, reload } = usePauseSettings();
  const [tab, setTab] = useState<Tab>('new');
  const [historyView, setHistoryView] = useState<StudentPauseView>(StudentPauseView.PAST);
  const [refreshKey, setRefreshKey] = useState(0);
  const changed = () => {
    setRefreshKey((n) => n + 1);
    void reload();
  };

  if (error && !data) return <ErrorState title="Couldn't load meal pause" description={error} onRetry={reload} />;
  if (!data) return <FullScreenLoader />;
  if (!data.linked) {
    return (
      <Screen edges={[]}>
        <NotLinkedCard mobile={session?.user.mobile ?? ''} />
      </Screen>
    );
  }
  if (!data.studentActive) {
    return <EmptyState icon="person-remove-outline" title="Your membership is inactive" description={`Please contact ${data.messName}.`} />;
  }
  if (!data.plans.length) {
    return <EmptyState icon="restaurant-outline" title="No meal plan to pause" description="Your mess has not assigned a meal plan yet." />;
  }

  return (
    <Screen edges={[]} onRefresh={changed} refreshing={false}>
      <Segments value={tab} onChange={setTab} />
      {tab === 'new' && <NewPause settings={data} onCreated={changed} />}
      {tab === 'upcoming' && <PauseList view={StudentPauseView.UPCOMING} refreshKey={refreshKey} onChanged={changed} />}
      {tab === 'history' && (
        <>
          <View style={styles.chips}>
            <Chip label="Past pauses" selected={historyView === StudentPauseView.PAST} onPress={() => setHistoryView(StudentPauseView.PAST)} />
            <Chip label="Resumed" selected={historyView === StudentPauseView.CANCELLED} onPress={() => setHistoryView(StudentPauseView.CANCELLED)} />
          </View>
          <PauseList view={historyView} refreshKey={refreshKey} onChanged={changed} />
        </>
      )}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  segments: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 4 },
  segment: { flex: 1, minHeight: TOUCH_TARGET - 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.brand600 },
  segmentLabel: { fontWeight: '600', fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: TOUCH_TARGET - 4, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, minHeight: TOUCH_TARGET, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink },
  pauseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET },
}));
