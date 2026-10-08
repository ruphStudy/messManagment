'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { businessToday, formatPaise, Permission, type Expense, type ExpenseSummary } from '@mess/shared';
import { CategoryBreakdown } from '@/components/expenses/category-breakdown';
import { ExpenseList } from '@/components/expenses/expense-list';
import { ExpenseTabs } from '@/components/expenses/expense-tabs';
import { FinanceCard } from '@/components/expenses/finance-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { formatDate } from '@/lib/format';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

const monthLabel = (month: string) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

function MonthScreen() {
  const currentMonth = businessToday().slice(0, 7);
  const list = useListParams({ month: currentMonth });
  const month = /^\d{4}-\d{2}$/.test(list.get('month')) ? list.get('month') : currentMonth;
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    setSummary(null);
    setSummaryError(false);
    api<ExpenseSummary>(`/expenses/monthly/summary?month=${month}`).then(setSummary).catch(() => setSummaryError(true));
  }, [month]);

  const apiQuery = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return new URLSearchParams({ from: `${month}-01`, to: end, status: 'RECORDED', page: String(list.page), pageSize: '25' }).toString();
  }, [month, list.page]);
  const { result, error, retry } = usePagedList<Expense>(`/expenses?${apiQuery}`);

  return (
    <>
      <PageHeader title="Monthly expenses" description={monthLabel(month)} />
      <ExpenseTabs active="/expenses/monthly" />
      <div className="mb-4 flex flex-col gap-1.5">
        <label htmlFor="month" className="text-sm font-medium">Month</label>
        <input id="month" type="month" max={currentMonth} value={month} onChange={(e) => e.target.value && list.setParams({ month: e.target.value, page: 1 })} className="h-11 w-48 rounded-control border border-border bg-surface px-3" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Total spent" />
          {summaryError ? <ErrorState title="Couldn't load the summary" /> : !summary ? <Skeleton className="h-32" /> : (
            <>
              <p className="mb-4 text-3xl font-bold">{formatPaise(summary.totalPaise)}<span className="ml-2 text-sm font-normal text-ink-muted">{summary.count} expenses</span></p>
              <CategoryBreakdown summary={summary} />
            </>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <FinanceCard month={month} />
          {summary && summary.daily.length > 0 && (
            <Card>
              <CardHeader title="By day" />
              <ul className="max-h-56 divide-y divide-border overflow-y-auto text-sm">
                {[...summary.daily].reverse().map((d) => (
                  <li key={d.date} className="flex justify-between py-1.5"><span>{formatDate(d.date)}</span><span className="font-semibold">{formatPaise(d.totalPaise)}</span></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Expenses in {monthLabel(month)}</h2>
      {error ? <ErrorState description={error} onRetry={retry} /> : !result ? <Skeleton className="h-40" /> : result.data.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses recorded this month." />
      ) : (
        <>
          <ExpenseList expenses={result.data} />
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}
    </>
  );
}

export default function MonthlyExpensesPage() {
  return (
    <RequireAuth permission={Permission.EXPENSE_VIEW}>
      <Suspense><MonthScreen /></Suspense>
    </RequireAuth>
  );
}
