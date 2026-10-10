'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Keyboard, QrCode, SearchX, Undo2, X } from 'lucide-react';
import {
  addDays,
  AttendanceStatus,
  ATTENDANCE_NOTE_MAX,
  businessToday,
  can,
  isValidDateString,
  MEAL_KEYS,
  MEAL_LABELS,
  Permission,
  type AttendanceRecord,
  type ExpectedMeals,
} from '@mess/shared';
import { PersonName } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/loader';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { formatMobile, fullName } from '@/lib/format';
import { longDate } from '@/lib/menu';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const linkButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold';
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: AttendanceStatus.SERVED, label: 'Served' },
  { value: AttendanceStatus.REVERSED, label: 'Reversed' },
];

function mealsLeft(a: AttendanceRecord) {
  return a.totalMealCredits === null ? 'Unlimited' : `${a.remainingMealCredits}/${a.totalMealCredits} left`;
}

function AttendanceScreen() {
  const { session } = useAuth();
  const toast = useToast();
  const canMark = can(session?.role, Permission.ATTENDANCE_MARK);
  const canReverse = can(session?.role, Permission.ATTENDANCE_REVERSE);

  const today = businessToday();
  const list = useListParams();
  const requested = list.get('date');
  const date = isValidDateString(requested) ? requested : today;
  const meal = list.get('meal');
  const status = list.get('status');
  const { page, search } = list;

  const [counts, setCounts] = useState<ExpectedMeals | null>(null);
  const [reversing, setReversing] = useState<AttendanceRecord | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ date, page: String(page), pageSize: '25' });
    if (meal) q.set('mealType', meal);
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    return q.toString();
  }, [date, meal, status, search, page]);
  const { result, error, retry } = usePagedList<AttendanceRecord>(`/attendance?${apiQuery}`);

  const loadSummary = useCallback(() => {
    api<ExpectedMeals>(`/attendance/expected?date=${date}`).then(setCounts).catch(() => setCounts(null));
  }, [date]);
  useEffect(loadSummary, [loadSummary]);

  const reverse = async () => {
    if (!reversing) return;
    setBusy(true);
    try {
      await api<AttendanceRecord>(`/attendance/${reversing.id}/reverse`, { method: 'POST', body: reason.trim() ? { reason: reason.trim() } : {} });
      toast.success('Meal reversed', reversing.creditDeducted ? 'One meal credit was given back.' : fullName(reversing.student));
      setReversing(null);
      retry();
      loadSummary();
    } catch (e) {
      toast.error('Could not reverse', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = !!(meal || status || search);
  const rows = result?.data;

  return (
    <>
      <PageHeader
        title="Attendance"
        description={longDate(date)}
        actions={
          canMark && (
            <>
              <Link href="/attendance/manual" className={`${linkButton} border border-border bg-surface hover:bg-canvas`}>
                <Keyboard className="size-4" aria-hidden /> Manual
              </Link>
              <Link href="/attendance/scan" className={`${linkButton} bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-500`}>
                <QrCode className="size-4" aria-hidden /> Scan QR
              </Link>
            </>
          )
        }
      />

      {/* Expected excludes paused students; served is what was actually given. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {MEAL_KEYS.map((key) => {
          const c = counts?.meals[key];
          return (
            <Card key={key} className="p-4 sm:p-4">
              <p className="text-sm font-medium">{MEAL_LABELS[key]}</p>
              <p className="text-2xl font-bold">
                {c ? c.served : '–'}
                <span className="ml-1 text-sm font-normal text-ink-muted">/ {c ? c.expected : '–'} served</span>
              </p>
              <p className="text-sm text-ink-muted">{c ? `${c.remaining} remaining · ${c.paused} paused` : ' '}</p>
            </Card>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        {[{ label: 'Today', value: today }, { label: 'Yesterday', value: addDays(today, -1) }].map((d) => (
          <Button key={d.label} size="sm" variant={date === d.value ? 'primary' : 'secondary'} onClick={() => list.setParams({ date: d.value === today ? null : d.value, page: 1 })}>
            {d.label}
          </Button>
        ))}
        <label htmlFor="att-date" className="sr-only">Date</label>
        <input
          id="att-date"
          type="date"
          max={today}
          value={date}
          onChange={(e) => isValidDateString(e.target.value) && list.setParams({ date: e.target.value === today ? null : e.target.value, page: 1 })}
          className="h-9 rounded-control border border-border bg-surface px-2 text-sm"
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <SearchInput label="Search student" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student name or mobile…" />
        <Select id="meal" label="Meal" className="sm:w-40" options={[{ value: '', label: 'All meals' }, ...MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))]} value={meal} onChange={(e) => list.setParams({ meal: e.target.value, page: 1 })} />
        <Select id="status" label="Status" className="sm:w-36" options={STATUS_OPTIONS} value={status} onChange={(e) => list.setParams({ status: e.target.value, page: 1 })} />
      </div>
      {hasFilters && (
        <button onClick={() => list.clear(['meal', 'status'])} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {error ? (
        <ErrorState title="Couldn't load attendance" description={error} onRetry={retry} />
      ) : !rows ? (
        <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6" />)}</Card>
      ) : rows.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={SearchX} title="No attendance matches your filters." />
        ) : (
          <EmptyState icon={ClipboardCheck} title="No meals served yet." description={date === today ? 'Scanned and manual entries will appear here.' : 'No attendance was recorded on this day.'} />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map((a) => {
              const reversed = a.status === AttendanceStatus.REVERSED;
              return (
                <li key={a.id}>
                  <Card className={cn('flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-4', reversed && 'bg-canvas')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PersonName name={fullName(a.student)} className={cn('font-semibold', reversed && 'line-through decoration-1')} />
                        <Badge tone="brand">{MEAL_LABELS[a.mealType]}</Badge>
                        <Badge tone={a.source === 'QR' ? 'info' : 'neutral'}>{a.source === 'QR' ? 'QR' : 'Manual'}</Badge>
                        {reversed && <Badge tone="danger">Reversed</Badge>}
                      </div>
                      <p className="text-sm text-ink-muted">
                        {timeFormat.format(new Date(a.servedAt))} · {formatMobile(a.student.mobile)} · {a.planName} · {mealsLeft(a)}
                        {a.servedBy && ` · by ${a.servedBy}`}
                      </p>
                      {a.note && <p className="text-sm text-ink-muted">Note: {a.note}</p>}
                      {reversed && (
                        <p className="text-sm text-danger">
                          Reversed {a.reversedAt && timeFormat.format(new Date(a.reversedAt))}
                          {a.reversedBy && ` by ${a.reversedBy}`}
                          {a.reversalReason && ` — ${a.reversalReason}`}
                        </p>
                      )}
                    </div>
                    {canReverse && !reversed && (
                      <Button variant="ghost" size="sm" className="self-start text-danger sm:self-center" onClick={() => { setReason(''); setReversing(a); }}>
                        <Undo2 className="size-4" aria-hidden /> Reverse
                      </Button>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}

      <Modal
        open={!!reversing}
        onClose={() => setReversing(null)}
        title="Reverse this meal?"
        description={reversing ? `${fullName(reversing.student)} · ${MEAL_LABELS[reversing.mealType]}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReversing(null)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={reverse} loading={busy}>Reverse meal</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-muted">
          The record stays in history, marked as reversed.
          {reversing?.creditDeducted && ' One meal credit will be given back.'} The student can then be served this meal again.
        </p>
        <Input id="reason" label="Reason (optional)" placeholder="e.g. Scanned by mistake" maxLength={ATTENDANCE_NOTE_MAX} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}

export default function AttendancePage() {
  return (
    <Suspense>
      <AttendanceScreen />
    </Suspense>
  );
}
