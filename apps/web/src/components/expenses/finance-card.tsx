'use client';

import { useEffect, useState } from 'react';
import { formatPaise, type FinanceMonthlySummary } from '@mess/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

/** Collected − expenses for a month. Labelled as an estimate, not accounting profit. */
export function FinanceCard({ month, className, title = 'Estimated operating balance' }: { month: string; className?: string; title?: string }) {
  const [data, setData] = useState<FinanceMonthlySummary | null>(null);
  useEffect(() => {
    setData(null);
    api<FinanceMonthlySummary>(`/finance/monthly-summary?month=${month}`).then(setData).catch(() => setData(null));
  }, [month]);

  const rows: [string, string, string?][] = data
    ? [
        ['Collected from students', formatPaise(data.collectedPaise), 'text-success'],
        ['Expenses', `− ${formatPaise(data.expensesPaise)}`, 'text-danger'],
      ]
    : [];
  return (
    <Card className={className}>
      <CardHeader title={title} description="Money collected minus money spent this month. A basic estimate, not accounting profit." />
      {!data ? (
        <div className="h-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <>
          <dl className="flex flex-col gap-1.5 text-sm">
            {rows.map(([label, value, tone]) => (
              <div key={label} className="flex justify-between gap-2"><dt className="text-ink-muted">{label}</dt><dd className={cn('font-semibold', tone)}>{value}</dd></div>
            ))}
            <div className="mt-1 flex justify-between gap-2 border-t border-border pt-2 text-base">
              <dt className="font-semibold">{data.netPaise >= 0 ? 'Estimated surplus' : 'Estimated shortfall'}</dt>
              <dd className={cn('font-bold', data.netPaise >= 0 ? 'text-success' : 'text-danger')}>{formatPaise(Math.abs(data.netPaise))}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">Pending dues of {formatPaise(data.pendingDuesPaise)} are not counted until collected.</p>
        </>
      )}
    </Card>
  );
}
