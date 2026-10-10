import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  emptyMealPlanForm,
  MEAL_KEYS,
  MEAL_LABELS,
  MEAL_PLAN_LIMITS,
  mealPlanToForm,
  Permission,
  PLAN_PRESETS,
  PlanDurationType,
  toMealPlanInput,
  validateMealPlan,
  type MealKey,
  type MealPlan,
  type MealPlanFormValues,
} from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { EmptyState, FullScreenLoader } from '@/components/states';
import { Chips, SectionTitle } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { confirm, mutate, useCan } from '@/lib/team';
import { colors } from '@/theme/tokens';

/** Create / edit a meal plan and switch it on/off — same API and shared validation as the web form. */
export default function PlanFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const can = useCan();
  const toast = useToast();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [v, setV] = useState<MealPlanFormValues | null>(id ? null : emptyMealPlanForm());
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<MealPlan>(`/meal-plans/${id}`).then((p) => { setPlan(p); setV(mealPlanToForm(p)); }).catch((e: unknown) => toast.show(errorMessage(e), 'error'));
  }, [id, toast]);
  if (!can(Permission.MEAL_PLAN_MANAGE)) return <EmptyState title="Not available for your role" />;
  if (!v) return <FullScreenLoader />;
  const set = (patch: Partial<MealPlanFormValues>) => { setV((x) => (x ? { ...x, ...patch } : x)); setErrors({}); };

  const save = async () => {
    const next = validateMealPlan(v);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      await api<MealPlan>(id ? `/meal-plans/${id}` : '/meal-plans', { method: id ? 'PATCH' : 'POST', body: toMealPlanInput(v) });
      toast.show(id ? 'Plan updated (existing subscriptions keep their terms)' : 'Plan created', 'success');
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, m]) => [k, m[0]])));
      toast.show(errorMessage(e), 'error');
      setBusy(false);
    }
  };
  const toggleStatus = () => {
    if (!plan) return;
    const active = plan.status === 'ACTIVE';
    confirm(active ? 'Deactivate this plan?' : 'Activate this plan?', active ? 'It can no longer be assigned. Students already on it are not affected.' : 'It can be assigned to students again.', active ? 'Deactivate' : 'Activate', () =>
      void mutate(() => api<MealPlan>(`/meal-plans/${plan.id}/status`, { method: 'PATCH', body: { status: active ? 'INACTIVE' : 'ACTIVE' } }), toast, active ? 'Plan deactivated' : 'Plan activated').then((p) => p && setPlan(p)),
    active);
  };
  const maxDuration = v.durationType === PlanDurationType.DAYS ? MEAL_PLAN_LIMITS.daysMax : MEAL_PLAN_LIMITS.monthsMax;

  return (
    <Screen edges={[]}>
      <SuspendedBanner />
      {!id && (
        <Card>
          <SectionTitle>Quick start</SectionTitle>
          <Chips options={PLAN_PRESETS.map((p) => ({ value: p.label, label: p.label }))} value={null} onChange={(label) => set(PLAN_PRESETS.find((p) => p.label === label)!.values)} />
        </Card>
      )}
      <Card>
        <TextField label="Plan name *" value={v.name} maxLength={MEAL_PLAN_LIMITS.nameMax} error={errors.name} onChangeText={(t) => set({ name: t })} />
        <TextField label="Price (₹) *" keyboardType="decimal-pad" value={v.price} error={errors.price} onChangeText={(t) => set({ price: t })} />
        <TextField label="Description (optional)" value={v.description} maxLength={MEAL_PLAN_LIMITS.descriptionMax} error={errors.description} onChangeText={(t) => set({ description: t })} />
      </Card>
      <Card>
        <SectionTitle>Meals included *</SectionTitle>
        <Chips options={MEAL_KEYS.map((k) => ({ value: k, label: MEAL_LABELS[k] }))} value={MEAL_KEYS.filter((k) => v[`${k}Included`])} onChange={(k: MealKey) => set({ [`${k}Included`]: !v[`${k}Included`] })} />
        {errors.meals && <AppText style={{ color: colors.danger }}>{errors.meals}</AppText>}
      </Card>
      <Card>
        <SectionTitle>Validity</SectionTitle>
        <Chips options={[{ value: PlanDurationType.MONTHS, label: 'Months' }, { value: PlanDurationType.DAYS, label: 'Days' }]} value={v.durationType} onChange={(t) => set({ durationType: t })} />
        <TextField label={`Number of ${v.durationType === PlanDurationType.DAYS ? 'days' : 'months'} (1–${maxDuration})`} keyboardType="number-pad" value={v.durationValue} error={errors.durationValue} onChangeText={(t) => set({ durationValue: t })} />
        <SectionTitle>Meals</SectionTitle>
        <Chips options={[{ value: 'unlimited', label: 'Unlimited during validity' }, { value: 'limited', label: 'Limited meal pack' }]} value={v.limited ? 'limited' : 'unlimited'} onChange={(x) => set({ limited: x === 'limited' })} />
        {v.limited && <TextField label={`Number of meals (1–${MEAL_PLAN_LIMITS.mealCreditsMax})`} keyboardType="number-pad" value={v.mealCredits} error={errors.mealCredits} onChangeText={(t) => set({ mealCredits: t })} />}
      </Card>
      <Button title={id ? 'Save changes' : 'Create plan'} onPress={save} loading={busy} />
      {plan && <Button title={plan.status === 'ACTIVE' ? 'Deactivate plan' : 'Activate plan'} variant={plan.status === 'ACTIVE' ? 'danger' : 'secondary'} onPress={toggleStatus} />}
    </Screen>
  );
}
