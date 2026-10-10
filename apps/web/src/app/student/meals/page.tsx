'use client';

import Link from 'next/link';
import { CheckCircle2, History, Undo2 } from 'lucide-react';
import { AttendanceStatus, MEAL_LABELS, type StudentAttendanceItem } from '@mess/shared';
import { LinkedOnly } from '@/components/student/linked-only';
import { useLoadMore } from '@/components/student/paged';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { dayLabel } from '@/lib/student/use-api';

const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function Meals() {
  const { items, meta, error, loading, load, hasMore } = useLoadMore<StudentAttendanceItem>('/students/me/attendance', 30);
  if (!meta && error) return <ErrorState title="Couldn't load meal history" description={error} onRetry={() => load(1)} />;
  if (!meta) return <Skeleton className="h-40" />;
  if (!items.length) return <EmptyState icon={History} title="No meals recorded yet." description="Meals you take at the mess will appear here." />;
  return (
    <ul className="flex flex-col gap-2">
      <li><Link href="/student/feedback" className="text-sm font-medium text-brand-700 hover:underline">Rate a recent meal →</Link></li>
      {items.map((i) => {
        const reversed = i.status === AttendanceStatus.REVERSED;
        return (
          <li key={i.id}>
            <Card className="flex items-center gap-3">
              {reversed ? <Undo2 className="size-5 text-ink-muted" aria-hidden /> : <CheckCircle2 className="size-5 text-success" aria-hidden />}
              <span className="flex-1">
                <span className={`block font-semibold ${reversed ? 'text-ink-muted line-through' : ''}`}>{MEAL_LABELS[i.mealType]} · {dayLabel(i.date)}</span>
                <span className="block text-sm text-ink-muted">{reversed ? 'Cancelled by mess — not counted' : `Served at ${time.format(new Date(i.servedAt))}`} · {i.planName}</span>
              </span>
            </Card>
          </li>
        );
      })}
      {hasMore && <Button variant="secondary" loading={loading} onClick={() => load(meta.page + 1)}>Load more</Button>}
    </ul>
  );
}

export default function StudentMealsPage() {
  return (
    <>
      <PageHeader title="Meal history" />
      <LinkedOnly><Meals /></LinkedOnly>
    </>
  );
}
