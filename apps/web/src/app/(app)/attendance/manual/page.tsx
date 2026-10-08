'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, QrCode } from 'lucide-react';
import { ATTENDANCE_NOTE_MAX, MEAL_LABELS, Permission, StudentStatus, type MealType, type ServeResult, type StudentListItem } from '@mess/shared';
import { MealPicker } from '@/components/attendance/meal-picker';
import { ServeResultBanner, type BannerState } from '@/components/attendance/serve-result-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageLoader, Spinner } from '@/components/ui/loader';
import { SearchInput } from '@/components/ui/search-input';
import { api, ApiError, errorMessage, isAbortError } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatMobile, fullName } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounce';
import { defaultMeal, useServedMeals } from '@/lib/use-served-meals';

/** Fallback when a student has no phone or the camera isn't working. Same rules as scanning. */
function ManualEntry({ meals }: { meals: MealType[] }) {
  const [meal, setMeal] = useState<MealType>(() => defaultMeal(meals));
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 250);
  const [results, setResults] = useState<StudentListItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentListItem | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);

  useEffect(() => {
    if (query.length < 2) return setResults(null);
    const controller = new AbortController();
    setSearchError(null);
    api<StudentListItem[]>(`/students?search=${encodeURIComponent(query)}&status=${StudentStatus.ACTIVE}&pageSize=8&sortBy=name&sortOrder=asc`, {
      signal: controller.signal,
    })
      .then(setResults)
      .catch((e: unknown) => !isAbortError(e) && setSearchError(errorMessage(e)));
    return () => controller.abort();
  }, [query]);

  const mark = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await api<ServeResult>('/attendance/manual', {
        method: 'POST',
        body: { studentId: selected.id, mealType: meal, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      setBanner({ kind: 'result', result });
      if (result.outcome === 'SERVED') {
        // Ready for the next student.
        setSelected(null);
        setSearch('');
        setNote('');
      }
    } catch (error) {
      setBanner(error instanceof ApiError && !error.isNetwork
        ? { kind: 'result', result: { outcome: 'REJECTED', reason: error.code as never, message: error.message, mealType: meal, student: null, planName: null } }
        : { kind: 'network' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <MealPicker meals={meals} value={meal} onChange={setMeal} />
      {banner && <ServeResultBanner state={banner} />}

      <Card className="flex flex-col gap-3">
        <SearchInput label="Search student" value={search} onChange={(v) => { setSearch(v); setBanner(null); }} placeholder="Name or mobile number" />
        {searchError && <p className="text-sm text-danger">{searchError}</p>}
        {query.length >= 2 && !results && !searchError && <div className="flex justify-center py-3"><Spinner className="text-brand-600" /></div>}
        {results && results.length === 0 && <p className="text-sm text-ink-muted">No active student matches “{query}”.</p>}
        {results && results.length > 0 && (
          <ul className="divide-y divide-border rounded-control border border-border">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelected(s)}
                  aria-pressed={selected?.id === s.id}
                  className={cn('flex min-h-14 w-full items-center gap-3 px-3 text-left', selected?.id === s.id ? 'bg-brand-50' : 'hover:bg-canvas')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{fullName(s)}</span>
                    <span className="block text-sm text-ink-muted">{formatMobile(s.mobile)}{s.hostelOrPg && ` · ${s.hostelOrPg}`}</span>
                  </span>
                  {selected?.id === s.id && <Check className="size-5 text-brand-700" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected && (
        <Card className="flex flex-col gap-3">
          <p>
            Mark <strong>{MEAL_LABELS[meal]}</strong> served for <strong>{fullName(selected)}</strong>
          </p>
          <Input id="note" label="Reason (optional)" placeholder="e.g. Phone not available" maxLength={ATTENDANCE_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="lg" onClick={mark} loading={saving}>Mark served</Button>
        </Card>
      )}
    </div>
  );
}

export default function ManualAttendancePage() {
  const meals = useServedMeals();
  return (
    <RequireAuth permission={Permission.ATTENDANCE_MARK}>
      <div className="mx-auto mb-4 flex max-w-xl items-center justify-between gap-2">
        <Link href="/attendance" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Attendance
        </Link>
        <Link href="/attendance/scan" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700">
          <QrCode className="size-4" aria-hidden /> Scan QR instead
        </Link>
      </div>
      <h1 className="mx-auto mb-4 max-w-xl text-display font-bold tracking-tight">Manual attendance</h1>
      {!meals ? <PageLoader /> : <ManualEntry meals={meals} />}
    </RequireAuth>
  );
}
