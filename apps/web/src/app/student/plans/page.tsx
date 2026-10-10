'use client';

import { History } from 'lucide-react';
import type { SubscriptionSummary } from '@mess/shared';
import { ChoosePlan } from '@/components/student/choose-plan';
import { LinkedOnly } from '@/components/student/linked-only';
import { useLoadMore } from '@/components/student/paged';
import { SubStatus } from '@/components/student/student-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatDate } from '@/lib/format';

function Plans() {
  const { items, meta, error, loading, load, hasMore } = useLoadMore<SubscriptionSummary>('/students/me/subscriptions');
  if (!meta && error) return <ErrorState title="Couldn't load your plans" description={error} onRetry={() => load(1)} />;
  if (!meta) return <Skeleton className="h-40" />;
  if (!items.length) return <EmptyState icon={History} title="No previous subscriptions." description="Plans your mess assigns will show here." />;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((s) => (
        <li key={s.id}>
          <Card>
            <div className="flex items-center gap-2"><p className="flex-1 font-semibold">{s.plan.name}</p><SubStatus status={s.status} /></div>
            <p className="text-sm text-ink-muted">{formatDate(s.startDate)} – {formatDate(s.endDate)}</p>
            {s.totalMealCredits !== null && <p className="text-xs text-ink-muted">{s.remainingMealCredits} of {s.totalMealCredits} meals left</p>}
          </Card>
        </li>
      ))}
      {hasMore && <Button variant="secondary" loading={loading} onClick={() => load(meta.page + 1)}>Load more</Button>}
    </ul>
  );
}

export default function StudentPlansPage() {
  return (
    <>
      <PageHeader title="Meal plans" />
      <LinkedOnly>
        <ChoosePlan />
        <h2 className="mb-2 mt-6 text-lg font-semibold">Plan history</h2>
        <Plans />
      </LinkedOnly>
    </>
  );
}
