'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { FEEDBACK_LIMITS, FEEDBACK_WINDOW_DAYS, MEAL_LABELS, RATING_DIMENSIONS, RATING_LABELS, type EligibleMeal, type RatingDimension } from '@mess/shared';
import { LinkedOnly } from '@/components/student/linked-only';
import { StarInput } from '@/components/student/student-ui';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dayLabel, useApi } from '@/lib/student/use-api';

type Values = Record<RatingDimension, number | null>;
const EMPTY: Values = { overall: null, taste: null, quality: null, quantity: null, cleanliness: null };
const textarea = 'min-h-24 w-full rounded-control border border-border bg-surface p-3';

/** Rate a recently served meal (only meals the API lists as eligible). */
function RateMeal() {
  const toast = useToast();
  const { data: meals, error, reload } = useApi<EligibleMeal[]>('/students/me/feedback/eligible-meals');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = meals?.find((m) => m.attendanceId === selectedId) ?? meals?.[0] ?? null;

  const submit = async () => {
    if (!selected || !values.overall) return;
    setSaving(true);
    try {
      await api('/students/me/feedback/meal', {
        method: 'POST',
        body: {
          attendanceId: selected.attendanceId,
          overallRating: values.overall,
          ...Object.fromEntries(RATING_DIMENSIONS.filter((d) => d !== 'overall' && values[d] !== null).map((d) => [`${d}Rating`, values[d]])),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        },
      });
      toast.success('Thanks for your feedback!');
      setValues(EMPTY);
      setComment('');
      setSelectedId(null);
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState title="Couldn't load your meals" description={error} onRetry={reload} />;
  if (!meals) return <Skeleton className="h-40" />;
  if (!meals.length) return <EmptyState icon={Star} title="No recent meals to rate." description={`Meals you are served can be rated within ${FEEDBACK_WINDOW_DAYS} days.`} />;
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Rate a meal" />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choose a meal">
        {meals.map((m) => {
          const on = m.attendanceId === selected?.attendanceId;
          return (
            <button key={m.attendanceId} type="button" role="radio" aria-checked={on} onClick={() => { setSelectedId(m.attendanceId); setValues(EMPTY); setComment(''); }} className={cn('min-h-11 rounded-control border px-3 py-1 text-left text-sm', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-surface hover:bg-canvas')}>
              <span className="block font-semibold">{MEAL_LABELS[m.mealType]}</span>
              <span className="block text-xs opacity-80">{dayLabel(m.date)}</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <>
          <StarInput large label={`How was ${MEAL_LABELS[selected.mealType].toLowerCase()}?`} value={values.overall} onChange={(v) => setValues((c) => ({ ...c, overall: v }))} />
          {values.overall !== null && (
            <>
              <p className="text-sm text-ink-muted">Optional details</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {RATING_DIMENSIONS.filter((d) => d !== 'overall').map((d) => <StarInput key={d} label={RATING_LABELS[d]} value={values[d]} onChange={(v) => setValues((c) => ({ ...c, [d]: v }))} />)}
              </div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={FEEDBACK_LIMITS.commentMax} placeholder="Anything to add? (optional)" aria-label="Comment" className={textarea} />
            </>
          )}
          <div><Button onClick={submit} loading={saving} disabled={!values.overall}>Submit rating</Button></div>
        </>
      )}
    </Card>
  );
}

/** General feedback about the mess: a rating, a comment, or both. */
function GeneralFeedback() {
  const toast = useToast();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const canSubmit = rating !== null || comment.trim().length > 0;
  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api('/students/me/feedback/general', { method: 'POST', body: { ...(rating !== null ? { overallRating: rating } : {}), ...(comment.trim() ? { comment: comment.trim() } : {}) } });
      toast.success('Thanks! Your mess will see your feedback.');
      setRating(null);
      setComment('');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="General feedback" description="Add a rating, a comment, or both. Only your mess sees this." />
      <StarInput label="How is the mess overall? (optional)" value={rating} onChange={setRating} />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={FEEDBACK_LIMITS.commentMax} placeholder="Suggestions, praise, ideas…" aria-label="Your feedback" className={textarea} />
      <div><Button onClick={submit} loading={saving} disabled={!canSubmit}>Send feedback</Button></div>
    </Card>
  );
}

export default function StudentFeedbackPage() {
  return (
    <>
      <PageHeader title="Feedback" description="Tell your mess how it's going" />
      <LinkedOnly>
        <div className="grid gap-4 lg:grid-cols-2">
          <RateMeal />
          <div className="flex flex-col gap-4">
            <GeneralFeedback />
            <Link href="/student/complaints/new" className="text-sm font-medium text-brand-700 hover:underline">Have a problem? Raise a complaint →</Link>
          </div>
        </div>
      </LinkedOnly>
    </>
  );
}
