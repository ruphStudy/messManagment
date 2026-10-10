'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Pencil, Plus, Power, SearchX } from 'lucide-react';
import { can, MealPlanStatus, Permission, type MealPlan } from '@mess/shared';
import { PlanFacts } from '@/components/meal-plans/plan-facts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatPrice } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounce';

const STATUS_OPTIONS = [
  { value: '', label: 'All plans' },
  { value: MealPlanStatus.ACTIVE, label: 'Active' },
  { value: MealPlanStatus.INACTIVE, label: 'Inactive' },
];

const linkButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold';

export default function MealPlansPage() {
  const { session } = useAuth();
  const toast = useToast();
  const canManage = can(session?.role, Permission.MEAL_PLAN_MANAGE);

  const [plans, setPlans] = useState<MealPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [deactivating, setDeactivating] = useState<MealPlan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Plans are few per mess, so the list is loaded unpaginated.
  const load = useCallback(() => {
    setError(null);
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (search) query.set('search', search);
    api<MealPlan[]>(`/meal-plans?${query}`)
      .then(setPlans)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [status, search]);
  useEffect(load, [load]);

  const setPlanStatus = async (plan: MealPlan, next: MealPlanStatus) => {
    setBusyId(plan.id);
    try {
      const updated = await api<MealPlan>(`/meal-plans/${plan.id}/status`, { method: 'PATCH', body: { status: next } });
      setPlans((all) => all?.map((p) => (p.id === updated.id ? updated : p)) ?? null);
      toast.success(next === MealPlanStatus.ACTIVE ? 'Plan activated' : 'Plan deactivated', plan.name);
      setDeactivating(null);
    } catch (e) {
      toast.error('Could not update plan', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = !!(status || search);
  const addButton = canManage && (
    <Link href="/meal-plans/new" className={`${linkButton} bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-500`}>
      <Plus className="size-4" aria-hidden /> Create meal plan
    </Link>
  );

  return (
    <>
      <PageHeader title="Meal plans" description="Plans you can assign to students" actions={addButton} />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <SearchInput label="Search plans" value={searchInput} onChange={setSearchInput} placeholder="Search plan name…" />
        <Select id="status" label="Status" className="sm:w-44" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
      </div>

      {error ? (
        <ErrorState title="Couldn't load meal plans" description={error} onRetry={load} />
      ) : !plans ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}><Skeleton className="mb-3 h-6 w-40" /><Skeleton className="h-4 w-full" /></Card>
          ))}
        </div>
      ) : plans.length === 0 ? (
        filtered ? (
          <EmptyState icon={SearchX} title="No plans match your filters." />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No meal plans created yet."
            description="Create plans like “Lunch + Dinner – 1 month” to assign to your students."
            action={addButton}
          />
        )
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {plans.map((plan) => {
            const inactive = plan.status === MealPlanStatus.INACTIVE;
            return (
              <li key={plan.id}>
                <Card className={inactive ? 'h-full opacity-75' : 'h-full'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{plan.name}</h2>
                      <p className="text-2xl font-bold text-brand-700">{formatPrice(plan.price)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={inactive ? 'neutral' : 'success'}>{inactive ? 'Inactive' : 'Active'}</Badge>
                      {plan.mealCredits !== null && <Badge tone="brand">Limited</Badge>}
                    </div>
                  </div>
                  <div className="mt-3"><PlanFacts plan={plan} /></div>
                  {plan.description && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{plan.description}</p>}
                  <p className="mt-2 text-xs text-ink-muted">
                    {plan.currentSubscriptionCount} current {plan.currentSubscriptionCount === 1 ? 'student' : 'students'}
                  </p>
                  {canManage && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                      <Link href={`/meal-plans/${plan.id}/edit`} className={`${linkButton} border border-border bg-surface hover:bg-canvas`}>
                        <Pencil className="size-4" aria-hidden /> Edit
                      </Link>
                      {inactive ? (
                        <Button variant="secondary" loading={busyId === plan.id} onClick={() => setPlanStatus(plan, MealPlanStatus.ACTIVE)}>
                          <Power className="size-4" aria-hidden /> Activate
                        </Button>
                      ) : (
                        <Button variant="ghost" onClick={() => setDeactivating(plan)}>
                          <Power className="size-4" aria-hidden /> Deactivate
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!deactivating}
        title={`Deactivate “${deactivating?.name}”?`}
        description="It can no longer be assigned to students. Students already on this plan keep it until their subscription ends."
        confirmLabel="Deactivate"
        loading={!!deactivating && busyId === deactivating.id}
        onConfirm={() => deactivating && setPlanStatus(deactivating, MealPlanStatus.INACTIVE)}
        onCancel={() => setDeactivating(null)}
      />
    </>
  );
}
