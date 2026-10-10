'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import {
  addDays,
  formatTime12h,
  isPauseCutoffPassed,
  MEAL_KEYS,
  MEAL_LABELS,
  PAUSE_MAX_DAYS,
  PAUSE_REASON_MAX,
  PAUSE_REASON_PRESETS,
  StudentPauseView,
  type CreatePauseResult,
  type MealType,
  type StudentPauseItem,
  type StudentPauseSettings,
} from '@mess/shared';
import { LinkedOnly } from '@/components/student/linked-only';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, apiEnvelope, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dayLabel, useApi } from '@/lib/student/use-api';

type Settings = Extract<StudentPauseSettings, { linked: true }>;
type Tab = 'new' | 'upcoming' | 'history';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Chip({ label, on, disabled, onClick }: { label: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} className={cn('min-h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-40', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-surface hover:bg-canvas')}>
      {label}
    </button>
  );
}

/** Next PAUSE_MAX_DAYS days; click one day, then another for a range (same as the app). */
function DateRangeGrid({ today, from, to, onChange }: { today: string; from: string | null; to: string | null; onChange: (f: string, t: string) => void }) {
  const lead = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days = Array.from({ length: PAUSE_MAX_DAYS }, (_, i) => addDays(today, i));
  const tap = (d: string) => (!from || from !== to || d < from ? onChange(d, d) : onChange(from, d));
  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {WEEKDAYS.map((w) => <span key={w} className="text-xs text-ink-muted">{w}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
      {days.map((d) => {
        const inRange = !!from && !!to && d >= from && d <= to;
        const edge = d === from || d === to;
        return (
          <button key={d} type="button" onClick={() => tap(d)} aria-pressed={inRange} aria-label={dayLabel(d)} className={cn('min-h-11 rounded-control text-sm font-medium', edge ? 'bg-brand-600 text-white' : inRange ? 'bg-brand-100' : 'hover:bg-canvas', d === today && !edge && 'text-brand-700 underline')}>
            {Number(d.slice(8))}
          </button>
        );
      })}
    </div>
  );
}

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
  /** Best-effort hints; the server re-checks everything. */
  const blocked = (m: MealType): string | null => {
    if (!from) return null;
    if (!settings.plans.some((p) => inRange(p) && p.meals[m])) return `${MEAL_LABELS[m]} is not in your plan for these dates.`;
    if (onlyToday && settings.todayMeals[m] === 'SERVED') return 'You already used this meal today.';
    if (onlyToday && settings.todayMeals[m] === 'PAUSED') return `${MEAL_LABELS[m]} is already paused for today.`;
    if (onlyToday && isPauseCutoffPassed(settings.today, settings.cutoffs[m], settings.today, settings.nowTime)) return `${MEAL_LABELS[m]} can no longer be paused for today.`;
    return null;
  };
  useEffect(() => setMeals((cur) => cur.filter((m) => !blocked(m))), [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!from || !to || !meals.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<CreatePauseResult>('/students/me/pauses', { method: 'POST', body: { fromDate: from, toDate: to, mealTypes: meals, ...(reason.trim() ? { reason: reason.trim() } : {}) } });
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
    <div className="flex flex-col gap-4">
      {result && (
        <Alert tone={result.created.length ? 'success' : 'info'}>
          <strong>{result.created.length ? `${result.created.length} ${result.created.length === 1 ? 'meal' : 'meals'} paused` : 'No meals were paused'}</strong>
          {problems.map((p) => <span key={`${p.date}-${p.mealType}`} className="block">{dayLabel(p.date)} · {p.message}</span>)}
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="1. Choose days" description="Click a day. Click another day to pause several days." />
          <DateRangeGrid today={settings.today} from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setResult(null); }} />
          {from && <p className="mt-2 font-semibold">{from === to ? dayLabel(from) : `${dayLabel(from)} → ${dayLabel(to!)}`}</p>}
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="2. Choose meals" />
            <div className="flex flex-wrap gap-2">
              {offered.map((m) => <Chip key={m} label={MEAL_LABELS[m]} on={meals.includes(m)} disabled={!from || !!blocked(m)} onClick={() => setMeals((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))} />)}
            </div>
            <ul className="mt-2 text-xs">
              {offered.map((m) => {
                const why = blocked(m);
                return <li key={m} className={why ? 'text-danger' : 'text-ink-muted'}>{why ?? `${MEAL_LABELS[m]} can be paused for today until ${formatTime12h(settings.cutoffs[m])}.`}</li>;
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title="3. Reason (optional)" />
            <div className="flex flex-wrap gap-2">{PAUSE_REASON_PRESETS.map((r) => <Chip key={r} label={r} on={reason === r} onClick={() => setReason(reason === r ? '' : r)} />)}</div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={PAUSE_REASON_MAX} placeholder="Or type a reason" aria-label="Reason" className="mt-3 h-11 w-full rounded-control border border-border bg-surface px-3" />
          </Card>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button onClick={submit} loading={saving} disabled={!from || !meals.length}>Pause meals</Button>
        </div>
      </div>
    </div>
  );
}

function PauseList({ view, refreshKey, onChanged }: { view: StudentPauseView; refreshKey: number; onChanged: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<StudentPauseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState<StudentPauseItem | null>(null);
  const [busy, setBusy] = useState(false);
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
  const groups = useMemo(() => {
    const map = new Map<string, StudentPauseItem[]>();
    for (const p of items ?? []) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return [...map.entries()];
  }, [items]);

  const resume = async () => {
    if (!resuming) return;
    setBusy(true);
    try {
      await api(`/students/me/pauses/${resuming.id}/cancel`, { method: 'POST' });
      toast.success(`${MEAL_LABELS[resuming.mealType]} resumed`);
      setResuming(null);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState title="Couldn't load pauses" description={error} onRetry={load} />;
  if (!items) return <Skeleton className="h-40" />;
  if (!items.length) return <EmptyState icon={PauseCircle} title={view === StudentPauseView.UPCOMING ? 'No meals paused.' : 'Nothing here yet.'} />;
  return (
    <div className="flex flex-col gap-3">
      {groups.map(([date, list]) => (
        <Card key={date}>
          <p className="mb-2 font-semibold">{dayLabel(date)}</p>
          <ul className="flex flex-col divide-y divide-border">
            {list.map((p) => (
              <li key={p.id} className="flex min-h-12 items-center gap-3">
                {p.status === 'CANCELLED' ? <PlayCircle className="size-5 text-ink-muted" aria-hidden /> : <PauseCircle className="size-5 text-brand-600" aria-hidden />}
                <span className="flex-1">
                  <span className={p.status === 'CANCELLED' ? 'text-ink-muted' : ''}>{MEAL_LABELS[p.mealType]} — {p.status === 'CANCELLED' ? 'Resumed' : 'Paused'}</span>
                  {(p.reason || p.source === 'MESS') && <span className="block text-xs text-ink-muted">{[p.reason, p.source === 'MESS' ? 'added by your mess' : null].filter(Boolean).join(' · ')}</span>}
                </span>
                {p.canCancel && <Button size="sm" variant="ghost" onClick={() => setResuming(p)}>Resume</Button>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <ConfirmDialog
        open={!!resuming}
        title={resuming ? `Resume ${MEAL_LABELS[resuming.mealType].toLowerCase()}?` : ''}
        description={resuming ? `${dayLabel(resuming.date)} — you will be expected for this meal again.` : ''}
        confirmLabel="Resume meal"
        cancelLabel="Keep paused"
        loading={busy}
        onConfirm={resume}
        onCancel={() => setResuming(null)}
      />
    </div>
  );
}

function Pause() {
  const { data, error, reload } = useApi<StudentPauseSettings>('/students/me/pause-settings');
  const [tab, setTab] = useState<Tab>('new');
  const [historyView, setHistoryView] = useState<StudentPauseView>(StudentPauseView.PAST);
  const [refreshKey, setRefreshKey] = useState(0);
  const changed = () => {
    setRefreshKey((n) => n + 1);
    void reload();
  };
  if (error && !data) return <ErrorState title="Couldn't load meal pause" description={error} onRetry={reload} />;
  if (!data || !data.linked) return <Skeleton className="h-64" />;
  if (!data.studentActive) return <EmptyState title="Your membership is inactive" description={`Please contact ${data.messName}.`} />;
  if (!data.plans.length) return <EmptyState title="No meal plan to pause" description="Your mess has not assigned a meal plan yet." />;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {([['new', 'Pause meals'], ['upcoming', 'Upcoming'], ['history', 'History']] as const).map(([k, l]) => (
          <Button key={k} role="tab" aria-selected={tab === k} size="sm" variant={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}>{l}</Button>
        ))}
      </div>
      {tab === 'new' && <NewPause settings={data} onCreated={changed} />}
      {tab === 'upcoming' && <PauseList view={StudentPauseView.UPCOMING} refreshKey={refreshKey} onChanged={changed} />}
      {tab === 'history' && (
        <>
          <div className="mb-3 flex gap-2">
            <Chip label="Past pauses" on={historyView === StudentPauseView.PAST} onClick={() => setHistoryView(StudentPauseView.PAST)} />
            <Chip label="Resumed" on={historyView === StudentPauseView.CANCELLED} onClick={() => setHistoryView(StudentPauseView.CANCELLED)} />
          </div>
          <PauseList view={historyView} refreshKey={refreshKey} onChanged={changed} />
        </>
      )}
    </>
  );
}

export default function StudentPausePage() {
  return (
    <>
      <PageHeader title="Pause meals" description="Tell your mess you won't eat a meal" />
      <LinkedOnly><Pause /></LinkedOnly>
    </>
  );
}
