'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { can, EXPENSE_LIMITS, Permission, type ExpenseCategory } from '@mess/shared';
import { ExpenseTabs } from '@/components/expenses/expense-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';

function CategoriesScreen() {
  const { session } = useAuth();
  const toast = useToast();
  const canManage = can(session?.role, Permission.EXPENSE_MANAGE);
  const [categories, setCategories] = useState<ExpenseCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(() => {
    setError(null);
    api<ExpenseCategory[]>('/expense-categories?includeInactive=true').then(setCategories).catch((e: unknown) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const patch = async (c: ExpenseCategory, body: { name?: string; isActive?: boolean }) => {
    try {
      await api(`/expense-categories/${c.id}`, { method: 'PATCH', body });
      setEditingId(null);
      load();
      if (body.isActive !== undefined) toast.success(body.isActive ? 'Category turned on' : 'Category turned off', c.name);
    } catch (e) {
      toast.error('Could not update category', errorMessage(e));
    }
  };

  const add = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api('/expense-categories', { method: 'POST', body: { name: newName.trim() } });
      toast.success('Category added', newName.trim());
      setNewName('');
      load();
    } catch (e) {
      toast.error('Could not add category', errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <PageHeader title="Expense categories" description="Turn off categories you don't use. Past expenses keep their category." />
      <ExpenseTabs active="/expenses/categories" />
      {canManage && (
        <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="mb-4 flex items-end gap-2">
          <Input id="new-category" label="New category" placeholder="e.g. Water supply" className="flex-1" maxLength={EXPENSE_LIMITS.categoryNameMax} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" loading={adding} disabled={!newName.trim()}>Add</Button>
        </form>
      )}
      {error ? <ErrorState description={error} onRetry={load} /> : !categories ? <Skeleton className="h-64" /> : (
        <Card className="divide-y divide-border p-0 sm:p-0">
          {categories.map((c) => (
            <div key={c.id} className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2">
              {editingId === c.id ? (
                <form onSubmit={(e) => { e.preventDefault(); void patch(c, { name: editName }); }} className="flex flex-1 items-center gap-2">
                  <label htmlFor={`edit-${c.id}`} className="sr-only">Category name</label>
                  <input id={`edit-${c.id}`} autoFocus maxLength={EXPENSE_LIMITS.categoryNameMax} value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 flex-1 rounded-control border border-border px-3" />
                  <Button size="sm" type="submit" aria-label="Save name"><Check className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel"><X className="size-4" /></Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-sm text-ink-muted">{c.expenseCount} {c.expenseCount === 1 ? 'expense' : 'expenses'}</span>
                  {!c.isActive && <Badge>Off</Badge>}
                  {canManage && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => { setEditingId(c.id); setEditName(c.name); }}><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="secondary" onClick={() => patch(c, { isActive: !c.isActive })}>{c.isActive ? 'Turn off' : 'Turn on'}</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export default function ExpenseCategoriesPage() {
  return (
    <RequireAuth permission={Permission.EXPENSE_VIEW}>
      <CategoriesScreen />
    </RequireAuth>
  );
}
