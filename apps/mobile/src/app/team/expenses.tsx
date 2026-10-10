import { useState } from 'react';
import { router } from 'expo-router';
import { businessToday, ExpenseStatus, formatPaise, Permission, type Expense, type ExpenseCategory, type ExpenseSummary } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, ListItem, SectionTitle, Stats } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { mutate, useApi, useCan, useLoadMore } from '@/lib/team';

/** Expenses with day / month totals (reversed rows shown, not counted) and categories. Owner/manager only. */
export default function ExpensesScreen() {
  const can = useCan();
  const toast = useToast();
  const today = businessToday();
  const [range, setRange] = useState<'today' | 'month'>('today');
  const from = range === 'today' ? today : `${today.slice(0, 7)}-01`;
  const summary = useApi<ExpenseSummary>(`/expenses/summary?from=${from}&to=${today}`);
  const list = useLoadMore<Expense>(`/expenses?from=${from}&to=${today}`);
  const categories = useApi<ExpenseCategory[]>('/expense-categories?includeInactive=true');
  const [newCategory, setNewCategory] = useState('');
  if (!can(Permission.EXPENSE_VIEW)) return <EmptyState title="Not available for your role" />;
  const addCategory = async () => {
    const ok = await mutate(() => api('/expense-categories', { method: 'POST', body: { name: newCategory.trim() } }), toast, 'Category added');
    if (ok) { setNewCategory(''); void categories.reload(); }
  };
  return (
    <Screen edges={[]} onRefresh={() => { void list.load(1); void summary.reload(); }} refreshing={list.loading && list.meta?.page === 1}>
      <SuspendedBanner />
      {can(Permission.EXPENSE_MANAGE) && <Button title="Add expense" onPress={() => router.push('/team/expense-form')} />}
      <Chips options={[{ value: 'today', label: 'Today' }, { value: 'month', label: 'This month' }]} value={range} onChange={setRange} />
      {summary.data && (
        <Card>
          <Stats items={[{ label: range === 'today' ? 'Spent today' : 'Spent this month', value: formatPaise(summary.data.totalPaise) }, { label: 'Expenses', value: summary.data.count }]} />
          {summary.data.categories.slice(0, 4).map((c) => <AppText key={c.categoryId} variant="caption" muted>{c.name}: {formatPaise(c.totalPaise)}</AppText>)}
        </Card>
      )}
      {!list.meta && list.error ? (
        <ErrorState title="Couldn't load expenses" description={list.error} onRetry={() => list.load(1)} />
      ) : !list.meta ? (
        <FullScreenLoader />
      ) : !list.items.length ? (
        <EmptyState icon="receipt-outline" title="No expenses recorded." />
      ) : (
        <>
          {list.items.map((e) => (
            <ListItem
              key={e.id}
              muted={e.status === ExpenseStatus.REVERSED}
              title={`${formatPaise(e.amountPaise)} · ${e.title}`}
              subtitle={`${formatDate(e.expenseDate)} · ${e.category.name}${e.vendorName ? ` · ${e.vendorName}` : ''}${e.status === ExpenseStatus.REVERSED ? ' · Reversed' : ''}`}
              onPress={can(Permission.EXPENSE_MANAGE) && e.status === ExpenseStatus.RECORDED ? () => router.push({ pathname: '/team/expense-form', params: { id: e.id } }) : undefined}
            />
          ))}
          {list.hasMore && <Button title="Load more" variant="secondary" loading={list.loading} onPress={() => list.load(list.meta!.page + 1)} />}
        </>
      )}
      {can(Permission.EXPENSE_MANAGE) && categories.data && (
        <Card>
          <SectionTitle>Categories</SectionTitle>
          <AppText variant="caption" muted>{categories.data.map((c) => `${c.name}${c.isActive ? '' : ' (off)'}`).join(' · ')}</AppText>
          <TextField label="New category" value={newCategory} onChangeText={setNewCategory} />
          <Button title="Add category" variant="secondary" disabled={!newCategory.trim()} onPress={addCategory} />
        </Card>
      )}
    </Screen>
  );
}
