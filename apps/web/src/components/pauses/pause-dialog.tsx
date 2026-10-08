'use client';

import { useEffect, useState } from 'react';
import {
  addDays,
  businessToday,
  MEAL_KEYS,
  MEAL_LABELS,
  PAUSE_MAX_DAYS,
  PAUSE_REASON_MAX,
  PAUSE_REASON_PRESETS,
  type CreatePauseResult,
  type MealType,
  type StudentListItem,
} from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SearchInput } from '@/components/ui/search-input';
import { api, errorMessage, isAbortError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMobile, fullName } from '@/lib/format';
import { shortDate } from '@/lib/menu';
import { useDebouncedValue } from '@/lib/use-debounce';

interface Props {
  open: boolean;
  /** Fixed student (from student detail); otherwise the dialog lets you search for one. */
  student?: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}

/** Mess team adds a pause on a student's behalf (e.g. they phoned in). Same rules as the student app. */
export function PauseDialog({ open, student, onClose, onDone }: Props) {
  const today = businessToday();
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(student ?? null);
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 250);
  const [matches, setMatches] = useState<StudentListItem[]>([]);
  const [fromDate, setFromDate] = useState(addDays(today, 1));
  const [toDate, setToDate] = useState(addDays(today, 1));
  const [meals, setMeals] = useState<MealType[]>(['lunch', 'dinner']);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatePauseResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(student ?? null);
    setSearch('');
    setFromDate(addDays(today, 1));
    setToDate(addDays(today, 1));
    setMeals(['lunch', 'dinner']);
    setReason('');
    setError(null);
    setResult(null);
  }, [open, student, today]);

  useEffect(() => {
    if (student || query.length < 2) return setMatches([]);
    const controller = new AbortController();
    api<StudentListItem[]>(`/students?search=${encodeURIComponent(query)}&status=ACTIVE&pageSize=6&sortBy=name&sortOrder=asc`, { signal: controller.signal })
      .then(setMatches)
      .catch((e: unknown) => !isAbortError(e) && setMatches([]));
    return () => controller.abort();
  }, [query, student]);

  const submit = async () => {
    if (!picked) return setError('Select a student');
    if (!meals.length) return setError('Select at least one meal');
    if (toDate < fromDate) return setError('End date must be on or after the start date');
    setSaving(true);
    setError(null);
    try {
      const res = await api<CreatePauseResult>(`/students/${picked.id}/pauses`, {
        method: 'POST',
        body: { fromDate, toDate, mealTypes: meals, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      });
      setResult(res);
      if (res.created.length) onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const problems = result ? [...result.skipped, ...result.failed] : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pause meals"
      description={picked?.name}
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={submit} loading={saving}>Pause meals</Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-3">
          <Alert tone={result.created.length ? 'success' : 'info'}>
            {result.created.length} {result.created.length === 1 ? 'meal' : 'meals'} paused.
          </Alert>
          {problems.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {problems.map((p) => (
                <li key={`${p.date}-${p.mealType}`} className="text-ink-muted">
                  <span className="font-medium text-ink">{shortDate(p.date)} · {MEAL_LABELS[p.mealType]}:</span> {p.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!student && (
            <div>
              {picked ? (
                <div className="flex items-center justify-between rounded-control bg-canvas p-3">
                  <span className="font-semibold">{picked.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <SearchInput label="Student" value={search} onChange={setSearch} placeholder="Search student name or mobile" />
                  {matches.length > 0 && (
                    <ul className="mt-2 divide-y divide-border rounded-control border border-border">
                      {matches.map((s) => (
                        <li key={s.id}>
                          <button className="flex min-h-11 w-full items-center justify-between px-3 text-left hover:bg-canvas" onClick={() => setPicked({ id: s.id, name: fullName(s) })}>
                            <span className="font-medium">{fullName(s)}</span>
                            <span className="text-sm text-ink-muted">{formatMobile(s.mobile)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input id="fromDate" type="date" label="From" min={today} value={fromDate} onChange={(e) => { setFromDate(e.target.value); if (e.target.value > toDate) setToDate(e.target.value); }} />
            <Input id="toDate" type="date" label="To" min={fromDate} max={addDays(fromDate, PAUSE_MAX_DAYS - 1)} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Meals</legend>
            <div className="flex flex-wrap gap-x-6">
              {MEAL_KEYS.map((m) => (
                <Checkbox key={m} id={`pause-${m}`} label={MEAL_LABELS[m]} checked={meals.includes(m)} onChange={(e) => setMeals((cur) => (e.target.checked ? [...cur, m] : cur.filter((x) => x !== m)))} />
              ))}
            </div>
          </fieldset>

          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {PAUSE_REASON_PRESETS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className={cn('min-h-9 rounded-full border px-3 text-sm', reason === r ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-border hover:bg-canvas')}>
                  {r}
                </button>
              ))}
            </div>
            <Input id="reason" label="Reason (optional)" maxLength={PAUSE_REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
