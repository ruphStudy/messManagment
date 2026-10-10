'use client';

import { useState } from 'react';
import { formatTime12, MEAL_LABELS, servingWindow, StudentMenuRange, type MealKey, type StudentMenuResponse } from '@mess/shared';
import { LinkedOnly } from '@/components/student/linked-only';
import { DayMenu, visibleMeals } from '@/components/student/student-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { dayLabel, useApi } from '@/lib/student/use-api';

const TABS = [
  { key: StudentMenuRange.TODAY, label: 'Today' },
  { key: StudentMenuRange.TOMORROW, label: 'Tomorrow' },
  { key: StudentMenuRange.WEEK, label: 'Week' },
];

function Menu() {
  const [tab, setTab] = useState<StudentMenuRange>(StudentMenuRange.TODAY);
  const { data, error, reload } = useApi<StudentMenuResponse>(`/students/me/menu/${tab}`);
  const timing = data?.linked
    ? (k: MealKey) => {
        const w = servingWindow(data.servingTimes, k);
        return `${formatTime12(w.start)} – ${formatTime12(w.end)}`;
      }
    : undefined;

  return (
    <>
      <div className="mb-4 flex gap-2" role="tablist">
        {TABS.map((t) => <Button key={t.key} role="tab" aria-selected={tab === t.key} size="sm" variant={tab === t.key ? 'primary' : 'secondary'} onClick={() => setTab(t.key)}>{t.label}</Button>)}
      </div>
      {error ? (
        <ErrorState title="Couldn't load the menu" description={error} onRetry={reload} />
      ) : !data || !data.linked ? (
        <Skeleton className="h-64" />
      ) : tab === StudentMenuRange.WEEK ? (
        <div className="flex flex-col gap-3">
          {data.days.map((d) => (
            <details key={d.date} className="rounded-card border border-border bg-surface p-4">
              <summary className="cursor-pointer font-semibold">{dayLabel(d.date)}</summary>
              {!d.menu ? (
                <p className="mt-2 text-ink-muted">Not published</p>
              ) : (
                <div className="mt-3">
                  <ul className="mb-3 text-sm">
                    {visibleMeals(d.menu, data.servedMeals).map((k) => (
                      <li key={k}><span className="text-ink-muted">{MEAL_LABELS[k]}:</span> {!d.menu![k].available ? 'Unavailable' : d.menu![k].items.join(', ') || '—'}</li>
                    ))}
                  </ul>
                  <DayMenu menu={d.menu} served={data.servedMeals} dayLabel="This day's" timing={timing} />
                </div>
              )}
            </details>
          ))}
        </div>
      ) : (
        <>
          <Card className="mb-3 p-3 text-sm text-ink-muted">{dayLabel(data.days[0].date)}</Card>
          <DayMenu menu={data.days[0].menu} served={data.servedMeals} dayLabel={tab === StudentMenuRange.TODAY ? "Today's" : "Tomorrow's"} timing={timing} />
        </>
      )}
    </>
  );
}

export default function StudentMenuPage() {
  return (
    <>
      <PageHeader title="Menu" description="What your mess is serving" />
      <LinkedOnly><Menu /></LinkedOnly>
    </>
  );
}
