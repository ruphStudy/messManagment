'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Plus, Receipt, SearchX, X } from 'lucide-react';
import {
  addDays,
  businessToday,
  can,
  ExpenseStatus,
  formatPaise,
  isValidDateString,
  Permission,
  type Expense,
  type ExpenseCategory,
  type ExpenseSummary,
} from '@mess/shared';
import { CategoryBreakdown } from '@/components/expenses/category-breakdown';
import { ExpenseDialog } from '@/components/expenses/expense-dialog';
import { ExpenseList } from '@/components/expenses/expense-list';
import { ExpenseTabs } from '@/components/expenses/expense-tabs';
import { ReverseExpenseDialog } from '@/components/expenses/reverse-expense-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { longDate } from '@/lib/menu';
import { RequireAuth } from '@/lib/auth/guards';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

function DaySummary({ date, refreshKey }: { date: string; refreshKey: number }) {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  useEffect(() => {
    api<ExpenseSummary>(`/expenses/summary?from=${date}&to=${date}`).then(setSummary).catch(() => setSummary(null));
  }, [date, refreshKey]);
  return (
    <Card className="mb-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-8">
      <div>
        <p className="text-sm text-ink-muted">{date === businessToday() ? 'Spent today' : `Spent on ${longDate(date)}`}</p>
        <p className="text-3xl font-bold">{summary ? formatPaise(summary.totalPaise) : '–'}</p>
        <p className="text-sm text-ink-muted">{summary ? `${summary.count} ${summary.count === 1 ? 'expense' : 'expenses'}` : ' '}</p>
      </div>
      {summary && summary.count > 0 && <CategoryBreakdown summary={summary} limit={4} />}
    </Card>
  );
}

function ExpensesScreen() {
  const { session } = useAuth();
  const canManage = can(session?.role, Permission.EXPENSE_MANAGE);
  const today = businessToday();
  const list = useListParams();
  const from = isValidDateString(list.get('from')) ? list.get('from') : '';
  const to = isValidDateString(list.get('to')) ? list.get('to') : '';
  const category = list.get('category');
  const status = list.get('status');
  const { page, search } = list;
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  // `?add=1` (dashboard quick action) opens the form straight away.
  const [editing, setEditing] = useState<Expense | null | 'new'>(() => (list.get('add') === '1' && canManage ? 'new' : null));
  const [reversing, setReversing] = useState<Expense | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api<ExpenseCategory[]>('/expense-categories?includeInactive=true').then(setCategories).catch(() => setCategories([]));
  }, []);

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (category) q.set('categoryId', category);
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    return q.toString();
  }, [page, from, to, category, status, search]);
  const { result, error, retry } = usePagedList<Expense>(`/expenses?${apiQuery}`);
  const changed = () => {
    retry();
    setRefreshKey((n) => n + 1);
  };

  const setRange = (f: string | null, t: string | null) => list.setParams({ from: f, to: t, page: 1 });
  const singleDay = from && from === to ? from : null;
  const hasFilters = !!(from || to || category || status || search);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Money spent by the mess"
        actions={canManage && <Button onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden /> Add expense</Button>}
      />
      <ExpenseTabs active="/expenses" />

      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { label: 'Today', f: today, t: today },
          { label: 'Yesterday', f: addDays(today, -1), t: addDays(today, -1) },
          { label: 'Last 7 days', f: addDays(today, -6), t: today },
          { label: 'All', f: null, t: null },
        ].map((r) => (
          <Button key={r.label} size="sm" variant={from === (r.f ?? '') && to === (r.t ?? '') ? 'primary' : 'secondary'} onClick={() => setRange(r.f, r.t)}>{r.label}</Button>
        ))}
      </div>

      {singleDay && <DaySummary date={singleDay} refreshKey={refreshKey} />}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end">
        <SearchInput label="Search expenses" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search title, shop, bill no…" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-sm font-medium">From</label>
          <input id="from" type="date" max={today} value={from} onChange={(e) => list.setParams({ from: e.target.value, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-sm font-medium">To</label>
          <input id="to" type="date" max={today} value={to} onChange={(e) => list.setParams({ to: e.target.value, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
        </div>
        <Select id="category" label="Category" options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.isActive ? c.name : `${c.name} (off)` }))]} value={category} onChange={(e) => list.setParams({ category: e.target.value, page: 1 })} />
        <Select id="status" label="Status" options={[{ value: '', label: 'All' }, { value: ExpenseStatus.RECORDED, label: 'Counted' }, { value: ExpenseStatus.REVERSED, label: 'Reversed' }]} value={status} onChange={(e) => list.setParams({ status: e.target.value, page: 1 })} />
      </div>
      {hasFilters && (
        <button onClick={() => list.clear(['from', 'to', 'category', 'status'])} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {error ? (
        <ErrorState title="Couldn't load expenses" description={error} onRetry={retry} />
      ) : !result ? (
        <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6" />)}</Card>
      ) : result.data.length === 0 ? (
        hasFilters ? <EmptyState icon={SearchX} title="No expenses match your filters." /> : (
          <EmptyState icon={Receipt} title="No expenses recorded yet." description="Track vegetables, gas, rent, salaries and more." action={canManage && <Button onClick={() => setEditing('new')}>Add expense</Button>} />
        )
      ) : (
        <>
          <ExpenseList expenses={result.data} onEdit={canManage ? setEditing : undefined} onReverse={canManage ? setReversing : undefined} />
          <Pagination meta={result.meta} onPage={(p) => list.setParams({ page: p })} />
        </>
      )}

      <ExpenseDialog
        open={!!editing}
        expense={editing === 'new' ? null : editing}
        onClose={() => { setEditing(null); list.setParams({ add: null }); }}
        onSaved={() => { setEditing(null); list.setParams({ add: null }); changed(); }}
      />
      <ReverseExpenseDialog expense={reversing} onClose={() => setReversing(null)} onDone={() => { setReversing(null); changed(); }} />
    </>
  );
}

export default function ExpensesPage() {
  return (
    <RequireAuth permission={Permission.EXPENSE_VIEW}>
      <Suspense><ExpensesScreen /></Suspense>
    </RequireAuth>
  );
}
