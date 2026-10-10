import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { businessToday, formatPaise, Permission, PlanChangeMode, SUBSCRIPTION_STATUS_LABELS, type MealPlan, type SubscriptionDetail } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, Row, SectionTitle } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { confirm, isDate, mutate, useApi, useCan } from '@/lib/team';

/** Assign, renew, change or cancel a student's meal plan (same endpoints and rules as the web). */
export default function SubscriptionScreen() {
  const { studentId, subscriptionId } = useLocalSearchParams<{ studentId: string; subscriptionId?: string }>();
  const can = useCan();
  const toast = useToast();
  const plans = useApi<MealPlan[]>('/meal-plans?status=ACTIVE');
  const sub = useApi<SubscriptionDetail>(subscriptionId ? `/subscriptions/${subscriptionId}` : null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(businessToday());
  const [mode, setMode] = useState<PlanChangeMode>(PlanChangeMode.AFTER_CURRENT);
  const [busy, setBusy] = useState(false);
  if (plans.error) return <ErrorState title="Couldn't load plans" description={plans.error} onRetry={plans.reload} />;
  if (!plans.data || (subscriptionId && !sub.data)) return <FullScreenLoader />;
  const back = () => router.replace({ pathname: '/team/student', params: { id: studentId } });
  const run = (path: string, body: object, done: string) =>
    void (async () => {
      setBusy(true);
      const res = await mutate(() => api(path, { method: 'POST', body }), toast, done);
      setBusy(false);
      if (res) back();
    })();
  const planChips = <Chips options={plans.data.map((p) => ({ value: p.id, label: `${p.name} · ₹${p.price}` }))} value={planId} onChange={setPlanId} />;
  const s = sub.data;

  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      {s && (
        <Card>
          <AppText variant="title">{s.plan.name}</AppText>
          <Row label="Status" value={SUBSCRIPTION_STATUS_LABELS[s.status]} />
          <Row label="Dates" value={`${formatDate(s.startDate)} – ${formatDate(s.endDate)}`} />
          <Row label="Meals left" value={s.totalMealCredits === null ? 'Unlimited' : `${s.remainingMealCredits} / ${s.totalMealCredits}`} />
          <Row label="Fee / paid / due" value={`${formatPaise(s.payment.payablePaise)} / ${formatPaise(s.payment.paidPaise)} / ${formatPaise(s.payment.duePaise)}`} />
        </Card>
      )}

      {!s ? (
        <Card>
          <SectionTitle>Assign a meal plan</SectionTitle>
          {plans.data.length ? planChips : <AppText muted>No active plans yet.</AppText>}
          {can(Permission.MEAL_PLAN_MANAGE) && <Button title="Create a meal plan" variant="ghost" onPress={() => router.push('/team/plan-form')} />}
          <TextField label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
          <Button title="Assign plan" loading={busy} disabled={!planId || !isDate(startDate)} onPress={() => run(`/students/${studentId}/subscriptions`, { mealPlanId: planId, startDate }, 'Plan assigned')} />
        </Card>
      ) : (
        (s.status === 'ACTIVE' || s.status === 'UPCOMING' || s.status === 'EXPIRED') && (
          <>
            <Card>
              <SectionTitle>Renew</SectionTitle>
              <AppText variant="caption" muted>Same plan (or pick one) starting after this one ends.</AppText>
              {planChips}
              <Button title="Renew" variant="secondary" loading={busy} onPress={() => run(`/subscriptions/${s.id}/renew`, planId ? { mealPlanId: planId } : {}, 'Renewed')} />
            </Card>
            {s.status !== 'EXPIRED' && (
              <Card>
                <SectionTitle>Change plan</SectionTitle>
                <Chips options={[{ value: PlanChangeMode.AFTER_CURRENT, label: 'After current ends' }, ...(can(Permission.SUBSCRIPTION_CANCEL) ? [{ value: PlanChangeMode.IMMEDIATE, label: 'Immediately' }] : [])]} value={mode} onChange={setMode} />
                <Button
                  title="Change plan"
                  variant="secondary"
                  loading={busy}
                  disabled={!planId}
                  onPress={() =>
                    mode === PlanChangeMode.IMMEDIATE
                      ? confirm('Change plan now?', 'The current plan is cancelled today and the new one starts.', 'Change now', () => run(`/subscriptions/${s.id}/change-plan`, { mealPlanId: planId, mode }, 'Plan changed'), true)
                      : run(`/subscriptions/${s.id}/change-plan`, { mealPlanId: planId, mode }, 'Plan change scheduled')
                  }
                />
              </Card>
            )}
            {can(Permission.SUBSCRIPTION_CANCEL) && s.status !== 'EXPIRED' && (
              <Button title="Cancel subscription" variant="danger" loading={busy} onPress={() => confirm('Cancel this subscription?', 'This cannot be undone. Payments stay recorded.', 'Cancel subscription', () => run(`/subscriptions/${s.id}/cancel`, {}, 'Subscription cancelled'), true)} />
            )}
          </>
        )
      )}
    </Screen>
  );
}
