import { router } from 'expo-router';
import { mealsLabel, Permission, type MealPlan } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { ListItem, Pill } from '@/components/team/kit';
import { PlanRequests } from '@/components/team/plan-requests';
import { useApi, useCan } from '@/lib/team';

/** Meal plans; owner/manager can create, edit and switch plans on/off (same API as the web). */
export default function PlansScreen() {
  const can = useCan();
  const manage = can(Permission.MEAL_PLAN_MANAGE);
  const { data, error, loading, reload } = useApi<MealPlan[]>('/meal-plans');
  if (error) return <ErrorState title="Couldn't load plans" description={error} onRetry={reload} />;
  if (!data) return <FullScreenLoader />;
  return (
    <Screen edges={[]} onRefresh={reload} refreshing={loading}>
      {can(Permission.SUBSCRIPTION_VIEW) && <PlanRequests />}
      {manage && <Button title="Create meal plan" onPress={() => router.push('/team/plan-form')} />}
      {!data.length && <EmptyState icon="clipboard-outline" title="No meal plans yet." description={manage ? 'Create your first plan to start assigning students.' : undefined} />}
      {data.map((p) => (
        <ListItem
          key={p.id}
          title={`${p.name} · ₹${p.price}`}
          subtitle={`${p.durationValue} ${p.durationType === 'DAYS' ? 'day(s)' : 'month(s)'} · ${mealsLabel(p)}${p.mealCredits ? ` · ${p.mealCredits} meals` : ' · unlimited'} · ${p.currentSubscriptionCount} using`}
          right={<Pill label={p.status === 'ACTIVE' ? 'Active' : 'Inactive'} tone={p.status === 'ACTIVE' ? 'success' : 'neutral'} />}
          onPress={manage ? () => router.push({ pathname: '/team/plan-form', params: { id: p.id } }) : undefined}
        />
      ))}
    </Screen>
  );
}
