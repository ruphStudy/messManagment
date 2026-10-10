'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { MessageSquare, SearchX, X } from 'lucide-react';
import {
  addDays,
  businessToday,
  FeedbackType,
  isValidDateString,
  MEAL_KEYS,
  MEAL_LABELS,
  Permission,
  RATING_DIMENSIONS,
  RATING_LABELS,
  type FeedbackItem,
  type RatingSummary,
} from '@mess/shared';
import { PersonName } from '@/components/ui/avatar';
import { RatingSummaryCards } from '@/components/feedback/rating-summary-cards';
import { Stars } from '@/components/feedback/stars';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatDate, fullName } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

function FeedbackScreen() {
  const today = businessToday();
  const list = useListParams({ type: FeedbackType.MEAL });
  const type = list.get('type') === FeedbackType.GENERAL ? FeedbackType.GENERAL : FeedbackType.MEAL;
  const from = isValidDateString(list.get('from')) ? list.get('from') : addDays(today, -29);
  const to = isValidDateString(list.get('to')) ? list.get('to') : today;
  const meal = list.get('meal');
  const rating = list.get('rating');
  const { page, search } = list;
  const [summary, setSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    setSummary(null);
    api<RatingSummary>(`/feedback/summary?from=${from}&to=${to}`).then(setSummary).catch(() => setSummary(null));
  }, [from, to]);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ type, from, to, page: String(page), pageSize: '25' });
    if (meal && type === FeedbackType.MEAL) q.set('mealType', meal);
    if (rating) q.set('rating', rating);
    if (search) q.set('search', search);
    return q.toString();
  }, [type, from, to, meal, rating, search, page]);
  const { result, error, retry } = usePagedList<FeedbackItem>(`/feedback?${apiQuery}`);
  const hasFilters = !!(meal || rating || search);
  const setRange = (f: string, t: string) => list.setParams({ from: f, to: t, page: 1 });

  return (
    <>
      <PageHeader title="Feedback" description="What students think about your food. Private to your mess." />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        {[{ label: 'Last 7 days', f: addDays(today, -6) }, { label: 'Last 30 days', f: addDays(today, -29) }, { label: 'This month', f: `${today.slice(0, 7)}-01` }].map((r) => (
          <Button key={r.label} size="sm" variant={from === r.f && to === today ? 'primary' : 'secondary'} onClick={() => setRange(r.f, today)}>{r.label}</Button>
        ))}
        <label htmlFor="from" className="sr-only">From</label>
        <input id="from" type="date" max={today} value={from} onChange={(e) => isValidDateString(e.target.value) && setRange(e.target.value, to)} className="h-9 rounded-control border border-border bg-surface px-2 text-sm" />
        <span className="self-center text-sm text-ink-muted">to</span>
        <label htmlFor="to" className="sr-only">To</label>
        <input id="to" type="date" max={today} value={to} onChange={(e) => isValidDateString(e.target.value) && setRange(from, e.target.value)} className="h-9 rounded-control border border-border bg-surface px-2 text-sm" />
      </div>

      <div className="mb-4"><RatingSummaryCards summary={summary} /></div>

      <nav aria-label="Feedback type" className="mb-4 inline-flex gap-1 rounded-full border border-border bg-surface p-1">
        {[{ key: FeedbackType.MEAL, label: 'Meal ratings' }, { key: FeedbackType.GENERAL, label: 'General feedback' }].map((t) => (
          <button key={t.key} onClick={() => list.setParams({ type: t.key, page: 1 })} aria-current={type === t.key ? 'page' : undefined} className={cn('min-h-10 rounded-full px-4 text-sm font-semibold', type === t.key ? 'bg-ink text-white dark:text-canvas' : 'text-ink-muted hover:bg-slate-100')}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <SearchInput label="Search student" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search student name or mobile…" />
        {type === FeedbackType.MEAL && (
          <Select id="meal" label="Meal" className="sm:w-40" options={[{ value: '', label: 'All meals' }, ...MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))]} value={meal} onChange={(e) => list.setParams({ meal: e.target.value, page: 1 })} />
        )}
        <Select id="rating" label="Overall rating" className="sm:w-40" options={[{ value: '', label: 'Any rating' }, ...[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} star${r === 1 ? '' : 's'}` }))]} value={rating} onChange={(e) => list.setParams({ rating: e.target.value, page: 1 })} />
      </div>
      {hasFilters && (
        <button onClick={() => list.clear(['meal', 'rating'])} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {error ? <ErrorState title="Couldn't load feedback" description={error} onRetry={retry} /> : !result ? <Skeleton className="h-48" /> : result.data.length === 0 ? (
        hasFilters ? <EmptyState icon={SearchX} title="No feedback matches your filters." /> : <EmptyState icon={MessageSquare} title="No feedback yet." description="Students can rate meals they were served and send general feedback from the app." />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {result.data.map((f) => (
              <li key={f.id}>
                <Card className="p-4 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <PersonName name={fullName(f.student)} className="font-semibold" />
                    <span className="text-sm text-ink-muted">{formatDate(f.date)}{f.mealType && ` · ${MEAL_LABELS[f.mealType]}`}</span>
                    <Stars value={f.overallRating} />
                    {f.mealReversed && <Badge>Meal reversed — not counted</Badge>}
                  </div>
                  {f.type === FeedbackType.MEAL && (
                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      {RATING_DIMENSIONS.filter((d) => d !== 'overall').map((d) => (
                        <div key={d} className="flex items-center gap-1.5"><dt className="text-ink-muted">{RATING_LABELS[d]}</dt><dd>{f[`${d}Rating`] ?? '—'}</dd></div>
                      ))}
                    </dl>
                  )}
                  {f.comment && <p className="mt-2 whitespace-pre-line break-words">“{f.comment}”</p>}
                </Card>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}
    </>
  );
}

export default function FeedbackPage() {
  return (
    <RequireAuth permission={Permission.FEEDBACK_VIEW}>
      <Suspense><FeedbackScreen /></Suspense>
    </RequireAuth>
  );
}
