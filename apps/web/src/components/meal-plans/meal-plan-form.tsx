'use client';

import Link from 'next/link';
import { PlanDurationType } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox, RadioGroup } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { PLAN_PRESETS, validateMealPlan, type MealPlanFormValues } from '@/lib/meal-plan-form';
import { useForm } from '@/lib/use-form';

interface MealPlanFormProps {
  initial: MealPlanFormValues;
  submitLabel: string;
  onSubmit: (values: MealPlanFormValues) => Promise<void>;
  showPresets?: boolean;
}

const DURATION_OPTIONS = [
  { value: PlanDurationType.MONTHS, label: 'Months' },
  { value: PlanDurationType.DAYS, label: 'Days' },
];

/** Shared by Add and Edit plan. */
export function MealPlanForm({ initial, submitLabel, onSubmit, showPresets }: MealPlanFormProps) {
  const form = useForm<MealPlanFormValues>({ initial, validate: validateMealPlan });
  const { values, errors, setField } = form;
  const disabled = form.submitting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {showPresets && (
        <div>
          <p className="mb-2 text-sm font-medium">Quick start</p>
          <div className="flex flex-wrap gap-2">
            {PLAN_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => form.setValues((v) => ({ ...v, ...preset.values }))}
                className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm font-medium hover:border-brand-500 hover:bg-brand-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Input id="name" label="Plan name" required value={values.name} error={errors.name} disabled={disabled} onChange={(e) => setField('name', e.target.value)} />
          <Input
            id="price"
            label="Price"
            prefix="₹"
            inputMode="decimal"
            required
            value={values.price}
            error={errors.price}
            disabled={disabled}
            onChange={(e) => setField('price', e.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>

        <fieldset disabled={disabled}>
          <legend className="mb-1 text-sm font-medium">
            Meals included <span className="text-danger">*</span>
          </legend>
          <div className="flex flex-wrap gap-x-6">
            <Checkbox id="lunchIncluded" label="Lunch" checked={values.lunchIncluded} onChange={(e) => setField('lunchIncluded', e.target.checked)} />
            <Checkbox id="dinnerIncluded" label="Dinner" checked={values.dinnerIncluded} onChange={(e) => setField('dinnerIncluded', e.target.checked)} />
            <Checkbox id="breakfastIncluded" label="Breakfast" checked={values.breakfastIncluded} onChange={(e) => setField('breakfastIncluded', e.target.checked)} />
          </div>
          {errors.meals && <p role="alert" className="text-sm text-danger">{errors.meals}</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="durationValue"
            label="Valid for"
            inputMode="numeric"
            required
            value={values.durationValue}
            error={errors.durationValue}
            disabled={disabled}
            onChange={(e) => setField('durationValue', e.target.value.replace(/\D/g, ''))}
          />
          <fieldset disabled={disabled} className="sm:pt-0.5">
            <RadioGroup
              name="durationType"
              label="Unit"
              value={values.durationType}
              options={DURATION_OPTIONS}
              onChange={(v) => setField('durationType', v)}
            />
          </fieldset>
        </div>

        <div className={cn('rounded-control border p-3', values.limited ? 'border-brand-200 bg-brand-50' : 'border-border')}>
          <Checkbox
            id="limited"
            label="Limited number of meals"
            description="For meal packs like “30 meals”. Leave off for unlimited meals during the validity."
            checked={values.limited}
            disabled={disabled}
            onChange={(e) => setField('limited', e.target.checked)}
          />
          {values.limited && (
            <Input
              id="mealCredits"
              label="Number of meals"
              inputMode="numeric"
              className="mt-2 sm:max-w-48"
              required
              value={values.mealCredits}
              error={errors.mealCredits}
              disabled={disabled}
              onChange={(e) => setField('mealCredits', e.target.value.replace(/\D/g, ''))}
            />
          )}
        </div>

        <Textarea
          id="description"
          label="Description (optional)"
          rows={2}
          value={values.description}
          error={errors.description}
          disabled={disabled}
          onChange={(e) => setField('description', e.target.value)}
        />
      </Card>

      {form.formError && <Alert tone="danger">{form.formError}</Alert>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/meal-plans"
          className="inline-flex h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-sm font-semibold hover:bg-canvas"
        >
          Cancel
        </Link>
        <Button type="submit" size="lg" loading={form.submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
