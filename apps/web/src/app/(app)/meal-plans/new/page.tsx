'use client';

import { useRouter } from 'next/navigation';
import { Permission, type MealPlan } from '@mess/shared';
import { MealPlanForm } from '@/components/meal-plans/meal-plan-form';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { emptyMealPlanForm, toMealPlanInput } from '@/lib/meal-plan-form';

function NewMealPlan() {
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <PageHeader title="Create meal plan" description="Pick a quick start or fill in the details." />
      <MealPlanForm
        showPresets
        initial={emptyMealPlanForm()}
        submitLabel="Create plan"
        onSubmit={async (values) => {
          const plan = await api<MealPlan>('/meal-plans', { method: 'POST', body: toMealPlanInput(values) });
          toast.success('Meal plan created', plan.name);
          router.replace('/meal-plans');
        }}
      />
    </>
  );
}

export default function NewMealPlanPage() {
  return (
    <RequireAuth permission={Permission.MEAL_PLAN_MANAGE}>
      <NewMealPlan />
    </RequireAuth>
  );
}
