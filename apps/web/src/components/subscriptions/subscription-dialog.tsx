'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  addDays,
  businessToday,
  calculateEndDate,
  can,
  MESSAGES,
  Permission,
  PlanChangeMode,
  validators,
  type MealPlan,
  type SubscriptionDetail,
  type SubscriptionSummary,
} from '@mess/shared';
import { PlanFacts } from '@/components/meal-plans/plan-facts';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/loader';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatPrice } from '@/lib/format';

export type SubscriptionDialogMode = 'assign' | 'renew' | 'change';

interface Props {
  open: boolean;
  mode: SubscriptionDialogMode;
  studentId: string;
  studentName: string;
  /** Required for renew / change. */
  current?: SubscriptionSummary;
  onClose: () => void;
  onDone: (created: SubscriptionDetail) => void;
}

const TITLES: Record<SubscriptionDialogMode, string> = { assign: 'Assign meal plan', renew: 'Renew plan', change: 'Change plan' };

/** One dialog for assigning, renewing and changing plans. The API re-checks every rule (overlap, active plan, student status). */
export function SubscriptionDialog({ open, mode, studentId, studentName, current, onClose, onDone }: Props) {
  const { session } = useAuth();
  const toast = useToast();
  const canChangeNow = can(session?.role, Permission.SUBSCRIPTION_CANCEL);
  const today = businessToday();
  const dayAfterCurrent = current ? addDays(current.endDate, 1) : today;

  const [plans, setPlans] = useState<MealPlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [changeMode, setChangeMode] = useState<PlanChangeMode>(PlanChangeMode.AFTER_CURRENT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCustomEnd(null);
    setChangeMode(PlanChangeMode.AFTER_CURRENT);
    setStartDate(mode === 'renew' ? (dayAfterCurrent > today ? dayAfterCurrent : today) : today);
    setPlanId(mode === 'renew' ? (current?.mealPlanId ?? '') : '');
    setLoadError(null);
    api<MealPlan[]>('/meal-plans?status=ACTIVE')
      .then(setPlans)
      .catch((e: unknown) => setLoadError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset each time the dialog opens
  }, [open]);

  const choices = useMemo(() => (plans ?? []).filter((p) => mode !== 'change' || p.id !== current?.mealPlanId), [plans, mode, current]);
  const plan = choices.find((p) => p.id === planId);
  // Renewing a plan that has since been deactivated: owner must pick another.
  const renewPlanMissing = mode === 'renew' && plans && current?.mealPlanId && !plans.some((p) => p.id === current.mealPlanId);

  const effectiveStart =
    mode === 'change' ? (changeMode === PlanChangeMode.IMMEDIATE ? today : dayAfterCurrent) : startDate;
  const computedEnd = plan && !validators.date(effectiveStart) ? calculateEndDate(effectiveStart, plan.durationType, plan.durationValue) : null;
  const endDate = mode !== 'change' && customEnd ? customEnd : computedEnd;
  const endError = endDate && endDate < effectiveStart ? 'End date must be on or after the start date' : undefined;

  const submit = async () => {
    if (!plan) return setError('Select a meal plan');
    if (mode !== 'change' && validators.date(startDate)) return setError(MESSAGES.date);
    if (endError) return setError(endError);
    setSaving(true);
    setError(null);
    try {
      const endOverride = customEnd && customEnd !== computedEnd ? { endDate: customEnd } : {};
      const created =
        mode === 'assign'
          ? await api<SubscriptionDetail>(`/students/${studentId}/subscriptions`, { method: 'POST', body: { mealPlanId: plan.id, startDate, ...endOverride } })
          : mode === 'renew'
            ? await api<SubscriptionDetail>(`/subscriptions/${current!.id}/renew`, { method: 'POST', body: { mealPlanId: plan.id, startDate, ...endOverride } })
            : await api<SubscriptionDetail>(`/subscriptions/${current!.id}/change-plan`, { method: 'POST', body: { mealPlanId: plan.id, mode: changeMode } });
      toast.success(mode === 'assign' ? 'Plan assigned' : mode === 'renew' ? 'Plan renewed' : 'Plan changed', `${studentName} · ${created.plan.name}`);
      onDone(created);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[mode]}
      description={studentName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!plan || !!endError}>
            {mode === 'assign' ? 'Assign plan' : mode === 'renew' ? 'Renew' : 'Change plan'}
          </Button>
        </>
      }
    >
      {loadError ? (
        <Alert tone="danger">{loadError}</Alert>
      ) : !plans ? (
        <div className="flex justify-center py-6"><Spinner className="text-brand-600" /></div>
      ) : choices.length === 0 ? (
        <Alert tone="info">
          No other active meal plans.{' '}
          <Link href="/meal-plans/new" className="font-semibold underline">Create a meal plan</Link>
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          {current && (
            <div className="rounded-control bg-canvas p-3 text-sm">
              <p className="text-ink-muted">Current plan</p>
              <p className="font-semibold">{current.plan.name}</p>
              <p className="text-ink-muted">Ends {formatDate(current.endDate)}</p>
            </div>
          )}

          <Select
            id="mealPlanId"
            label={mode === 'change' ? 'New plan' : 'Meal plan'}
            placeholder="Select a plan"
            options={choices.map((p) => ({ value: p.id, label: `${p.name} · ${formatPrice(p.price)}` }))}
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              setCustomEnd(null);
            }}
            hint={renewPlanMissing ? 'The previous plan is no longer active. Choose a plan.' : undefined}
          />

          {plan && (
            <div className="rounded-control border border-brand-200 bg-brand-50 p-3">
              <p className="mb-1 font-semibold">{formatPrice(plan.price)}</p>
              <PlanFacts plan={plan} />
            </div>
          )}

          {mode === 'change' ? (
            <RadioGroup
              name="changeMode"
              label="When should the new plan start?"
              value={changeMode}
              onChange={setChangeMode}
              options={[
                { value: PlanChangeMode.AFTER_CURRENT, label: 'After current plan ends', description: `Starts ${formatDate(dayAfterCurrent)}` },
                ...(canChangeNow
                  ? [{ value: PlanChangeMode.IMMEDIATE, label: 'Immediately', description: `Starts today (${formatDate(today)})` }]
                  : []),
              ]}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="startDate"
                type="date"
                label="Start date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCustomEnd(null);
                }}
              />
              <Input
                id="endDate"
                type="date"
                label="End date"
                value={endDate ?? ''}
                disabled={!plan}
                error={endError}
                hint={customEnd && customEnd !== computedEnd ? 'Custom end date' : 'Calculated from the plan'}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}

          {mode === 'change' && changeMode === PlanChangeMode.IMMEDIATE && (
            <Alert tone="danger">
              The current plan will be cancelled today{current?.remainingMealCredits ? ` (${current.remainingMealCredits} meals left will be lost)` : ''}.
              No refund or adjustment is calculated.
            </Alert>
          )}
          {mode === 'change' && endDate && (
            <p className="text-sm text-ink-muted">New plan runs {formatDate(effectiveStart)} – {formatDate(endDate)}.</p>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
