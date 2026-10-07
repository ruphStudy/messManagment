'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Permission, type MealPlan } from '@mess/shared';
import { MealPlanForm } from '@/components/meal-plans/meal-plan-form';
import { Alert } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { mealPlanToForm, toMealPlanInput } from '@/lib/meal-plan-form';

function EditMealPlan({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<MealPlan>(`/meal-plans/${id}`)
      .then(setPlan)
      .catch((e: unknown) => setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 }));
  }, [id]);
  useEffect(load, [load]);

  if (error?.notFound) {
    return (
      <EmptyState
        title="Meal plan not found"
        action={<Link href="/meal-plans" className="font-semibold text-brand-700 hover:underline">Back to meal plans</Link>}
      />
    );
  }
  if (error) return <ErrorState title="Couldn't load plan" description={error.message} onRetry={load} />;
  if (!plan) return <PageLoader />;

  return (
    <>
      <PageHeader title={`Edit ${plan.name}`} />
      {plan.currentSubscriptionCount > 0 && (
        <Alert tone="info" className="mb-4">
          {plan.currentSubscriptionCount} {plan.currentSubscriptionCount === 1 ? 'student is' : 'students are'} on this plan. Changes apply to
          new assignments only — existing subscriptions keep the price, meals and dates they were given.
        </Alert>
      )}
      <MealPlanForm
        key={plan.updatedAt}
        initial={mealPlanToForm(plan)}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          await api<MealPlan>(`/meal-plans/${id}`, { method: 'PATCH', body: toMealPlanInput(values) });
          toast.success('Plan updated');
          router.replace('/meal-plans');
        }}
      />
    </>
  );
}

export default function EditMealPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth permission={Permission.MEAL_PLAN_MANAGE}>
      <EditMealPlan id={id} />
    </RequireAuth>
  );
}
