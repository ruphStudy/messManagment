'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List, PauseCircle, Plus, SearchX, X } from 'lucide-react';
import {
  addDays,
  businessToday,
  can,
  isValidDateString,
  MEAL_KEYS,
  MEAL_LABELS,
  PauseStatus,
  Permission,
  type ExpectedMeals,
  type PauseCalendarDay,
  type PauseRecord,
} from '@mess/shared';
import { CancelPauseDialog } from '@/components/pauses/cancel-pause-dialog';
import { PauseDialog } from '@/components/pauses/pause-dialog';
import { PauseRow } from '@/components/pauses/pause-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { longDate, shortDate } from '@/lib/menu';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const CALENDAR_DAYS = 14;

/** Expected / paused for one day — what the kitchen should plan for. */
function DayCounts({ date }: { date: string }) {
  const [counts, setCounts] = useState<ExpectedMeals | null>(null);
  useEffect(() => {
    setCounts(null);
    api<ExpectedMeals>(`/attendance/expected?date=${date}`).then(setCounts).catch(() => setCounts(null));
  }, [date]);
  return (
    <div className="mb-4 grid grid-cols-3 gap-3">
      {MEAL_KEYS.map((m) => (
        <Card key={m} className="p-4 sm:p-4">
          <p className="text-sm text-ink-muted">{MEAL_LABELS[m]}</p>
          <p className="text-2xl font-bold">{counts ? counts.meals[m].expected : '–'}<span className="ml-1 text-sm font-normal text-ink-muted">expected</span></p>
          <p className="text-sm text-ink-muted">{counts ? `${counts.meals[m].paused} paused` : ' '}</p>
        </Card>
      ))}
    </div>
  );
}

function Calendar({ onPick }: { onPick: (date: string) => void }) {
  const today = businessToday();
  const [start, setStart] = useState(today);
  const [days, setDays] = useState<PauseCalendarDay[] | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setDays(null);
    setError(false);
    api<PauseCalendarDay[]>(`/pauses/calendar?from=${start}&to=${addDays(start, CALENDAR_DAYS - 1)}`).then(setDays).catch(() => setError(true));
  }, [start]);
  useEffect(load, [load]);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" variant="secondary" aria-label="Earlier" onClick={() => setStart(addDays(start, -CALENDAR_DAYS))}><ChevronLeft className="size-4" /></Button>
        <Button size="sm" variant="secondary" onClick={() => setStart(today)} disabled={start === today}>From today</Button>
        <Button size="sm" variant="secondary" aria-label="Later" onClick={() => setStart(addDays(start, CALENDAR_DAYS))}><ChevronRight className="size-4" /></Button>
        <span className="ml-2 text-sm text-ink-muted">{shortDate(start)} – {shortDate(addDays(start, CALENDAR_DAYS - 1))}</span>
      </div>
      {error ? (
        <ErrorState title="Couldn't load the calendar" onRetry={load} />
      ) : !days ? (
        <Skeleton className="h-48" />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((d) => {
            const total = d.breakfast + d.lunch + d.dinner;
            return (
              <li key={d.date}>
                <button
                  onClick={() => onPick(d.date)}
                  className={cn('flex h-full w-full flex-col gap-1 rounded-card border bg-surface p-3 text-left hover:border-brand-500', d.date === today ? 'border-brand-500' : 'border-border')}
                >
                  <span className="text-sm font-semibold">{shortDate(d.date)}</span>
                  {total === 0 ? (
                    <span className="text-xs text-ink-muted">No pauses</span>
                  ) : (
                    MEAL_KEYS.filter((m) => d[m] > 0).map((m) => (
                      <span key={m} className="text-xs"><span className="text-ink-muted">{MEAL_LABELS[m]}:</span> <strong>{d[m]}</strong> paused</span>
                    ))
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function PausesScreen() {
  const { session } = useAuth();
  const canManage = can(session?.role, Permission.PAUSE_MANAGE);
  const today = businessToday();
  const list = useListParams();
  const view = list.get('view') === 'calendar' ? 'calendar' : 'list';
  const from = isValidDateString(list.get('from')) ? list.get('from') : today;
  const to = isValidDateString(list.get('to')) && list.get('to') >= from ? list.get('to') : from;
  const meal = list.get('meal');
  const status = list.get('status') || PauseStatus.ACTIVE;
  const { page, search } = list;
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<PauseRecord | null>(null);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ from, to, page: String(page), pageSize: '30' });
    if (meal) q.set('mealType', meal);
    if (status !== 'ALL') q.set('status', status);
    if (search) q.set('search', search);
    return q.toString();
  }, [from, to, meal, status, search, page]);
  const { result, error, retry } = usePagedList<PauseRecord>(`/pauses?${apiQuery}`);
  const reload = retry;

  const setRange = (f: string, t: string) => list.setParams({ from: f === today ? null : f, to: t === f ? null : t, page: 1, view: null });
  const ranges = [
    { label: 'Today', from: today, to: today },
    { label: 'Tomorrow', from: addDays(today, 1), to: addDays(today, 1) },
    { label: 'Next 7 days', from: today, to: addDays(today, 6) },
  ];
  const hasFilters = !!(meal || search || list.get('status'));

  return (
    <>
      <PageHeader
        title="Meal pauses"
        description="Students who won't eat a meal — so you cook the right amount."
        actions={canManage && <Button onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden /> Pause for student</Button>}
      />

      <nav aria-label="Views" className="mb-4 inline-flex gap-1 rounded-full border border-border bg-surface p-1">
        {[{ key: 'list', label: 'List', Icon: List }, { key: 'calendar', label: 'Calendar', Icon: CalendarDays }].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => list.setParams({ view: key === 'list' ? null : key })}
            aria-current={view === key ? 'page' : undefined}
            className={cn('inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold', view === key ? 'bg-ink text-white dark:text-canvas' : 'text-ink-muted hover:bg-slate-100')}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </nav>

      {view === 'calendar' ? (
        <Calendar onPick={(d) => setRange(d, d)} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            {ranges.map((r) => (
              <Button key={r.label} size="sm" variant={from === r.from && to === r.to ? 'primary' : 'secondary'} onClick={() => setRange(r.from, r.to)}>{r.label}</Button>
            ))}
            <label className="sr-only" htmlFor="from">From</label>
            <input id="from" type="date" value={from} onChange={(e) => isValidDateString(e.target.value) && setRange(e.target.value, e.target.value > to ? e.target.value : to)} className="h-9 rounded-control border border-border bg-surface px-2 text-sm" />
            <span className="self-center text-sm text-ink-muted">to</span>
            <label className="sr-only" htmlFor="to">To</label>
            <input id="to" type="date" min={from} max={addDays(from, 30)} value={to} onChange={(e) => isValidDateString(e.target.value) && setRange(from, e.target.value)} className="h-9 rounded-control border border-border bg-surface px-2 text-sm" />
          </div>

          {from === to && <DayCounts date={from} />}

          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <SearchInput label="Search student" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student name or mobile…" />
            <Select id="meal" label="Meal" className="sm:w-40" options={[{ value: '', label: 'All meals' }, ...MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))]} value={meal} onChange={(e) => list.setParams({ meal: e.target.value, page: 1 })} />
            <Select
              id="status"
              label="Status"
              className="sm:w-40"
              options={[{ value: PauseStatus.ACTIVE, label: 'Active' }, { value: PauseStatus.CANCELLED, label: 'Cancelled' }, { value: 'ALL', label: 'All' }]}
              value={status}
              onChange={(e) => list.setParams({ status: e.target.value === PauseStatus.ACTIVE ? null : e.target.value, page: 1 })}
            />
          </div>
          {hasFilters && (
            <button onClick={() => list.clear(['meal', 'status'])} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              <X className="size-4" aria-hidden /> Clear filters
            </button>
          )}

          {error ? (
            <ErrorState title="Couldn't load pauses" description={error} onRetry={retry} />
          ) : !result ? (
            <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-6" />)}</Card>
          ) : result.data.length === 0 ? (
            hasFilters ? (
              <EmptyState icon={SearchX} title="No pauses match your filters." />
            ) : (
              <EmptyState icon={PauseCircle} title={from === to ? 'No paused meals for this date.' : 'No paused meals in these dates.'} description={from === to ? longDate(from) : undefined} />
            )
          ) : (
            <>
              <Card className="divide-y divide-border px-4 py-1 sm:px-5">
                {result.data.map((p) => <PauseRow key={p.id} pause={p} onCancel={canManage ? setCancelling : undefined} />)}
              </Card>
              <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
            </>
          )}
        </>
      )}

      <PauseDialog open={adding} onClose={() => setAdding(false)} onDone={reload} />
      <CancelPauseDialog pause={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reload(); }} />
    </>
  );
}

export default function PausesPage() {
  return (
    <Suspense>
      <PausesScreen />
    </Suspense>
  );
}
