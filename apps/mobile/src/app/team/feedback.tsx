import { useState } from 'react';
import { businessToday, FeedbackType, MEAL_LABELS, Permission, RATING_DIMENSIONS, RATING_LABELS, type FeedbackItem, type RatingSummary } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, ListItem, Stats } from '@/components/team/kit';
import { formatDate } from '@/lib/student-profile';
import { useApi, useCan, useLoadMore } from '@/lib/team';

/** Ratings for this month and the feedback list (owner/manager). */
export default function FeedbackScreen() {
  const can = useCan();
  const today = businessToday();
  const from = `${today.slice(0, 7)}-01`;
  const [type, setType] = useState<FeedbackType | ''>('');
  const summary = useApi<RatingSummary>(`/feedback/summary?from=${from}&to=${today}`);
  const list = useLoadMore<FeedbackItem>(`/feedback?from=${from}&to=${today}${type ? `&type=${type}` : ''}`);
  if (!can(Permission.FEEDBACK_VIEW)) return <EmptyState title="Not available for your role" />;
  const stars = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)}★`);
  return (
    <Screen edges={[]} onRefresh={() => { void list.load(1); void summary.reload(); }} refreshing={list.loading && list.meta?.page === 1}>
      {summary.data && (
        <Card>
          <Stats items={[...RATING_DIMENSIONS.map((d) => ({ label: RATING_LABELS[d], value: stars(summary.data!.averages[d]) })), { label: 'Ratings this month', value: summary.data.mealCount + summary.data.generalCount }]} />
        </Card>
      )}
      <Chips options={[{ value: '', label: 'All' }, { value: FeedbackType.MEAL, label: 'Meal' }, { value: FeedbackType.GENERAL, label: 'General' }]} value={type} onChange={(v) => setType(v as FeedbackType | '')} />
      {!list.meta && list.error ? (
        <ErrorState title="Couldn't load feedback" description={list.error} onRetry={() => list.load(1)} />
      ) : !list.meta ? (
        <FullScreenLoader />
      ) : !list.items.length ? (
        <EmptyState icon="star-outline" title="No feedback this month." />
      ) : (
        <>
          {list.items.map((f) => (
            <ListItem
              key={f.id}
              avatar={[f.student.firstName, f.student.lastName].filter(Boolean).join(' ')}
              muted={f.mealReversed}
              title={`${f.overallRating ? `${f.overallRating}★ ` : ''}${f.type === 'MEAL' && f.mealType ? MEAL_LABELS[f.mealType] : 'General'} · ${[f.student.firstName, f.student.lastName].filter(Boolean).join(' ')}`}
              subtitle={`${formatDate(f.date)}${f.comment ? ` · “${f.comment}”` : ''}${f.mealReversed ? ' · meal reversed (not counted)' : ''}`}
            />
          ))}
          {list.hasMore && <Button title="Load more" variant="secondary" loading={list.loading} onPress={() => list.load(list.meta!.page + 1)} />}
        </>
      )}
    </Screen>
  );
}
