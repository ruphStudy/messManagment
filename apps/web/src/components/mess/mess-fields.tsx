'use client';

import {
  DEFAULT_COUNTRY_CODE,
  FOOD_TYPE_LABELS,
  FoodType,
  INDIAN_STATES,
  MESS_TYPE_LABELS,
  MessType,
} from '@mess/shared';
import { Checkbox, RadioGroup } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { MessFormValues } from '@/lib/mess-form';
import type { FieldErrors } from '@/lib/use-form';

export interface MessFieldsProps {
  values: MessFormValues;
  errors: FieldErrors<MessFormValues>;
  setField: <K extends keyof MessFormValues>(key: K, value: MessFormValues[K]) => void;
  disabled?: boolean;
}

const messTypeOptions = Object.values(MessType).map((value) => ({ value, label: MESS_TYPE_LABELS[value] }));
const foodTypeOptions = Object.values(FoodType).map((value) => ({ value, label: FOOD_TYPE_LABELS[value] }));
const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));

export function MessBasicFields({ values, errors, setField, disabled }: MessFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        id="name"
        label="Mess name"
        placeholder="e.g. Annapurna Mess"
        required
        disabled={disabled}
        value={values.name}
        error={errors.name}
        onChange={(e) => setField('name', e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="mobile"
          label="Contact number"
          prefix={DEFAULT_COUNTRY_CODE}
          inputMode="numeric"
          maxLength={10}
          required
          disabled={disabled}
          value={values.mobile}
          error={errors.mobile}
          hint="Students will call this number"
          onChange={(e) => setField('mobile', e.target.value.replace(/\D/g, ''))}
        />
        <Input
          id="email"
          type="email"
          label="Email (optional)"
          disabled={disabled}
          value={values.email}
          error={errors.email}
          onChange={(e) => setField('email', e.target.value)}
        />
      </div>
      <Select
        id="messType"
        label="Type of mess"
        options={messTypeOptions}
        disabled={disabled}
        value={values.messType}
        onChange={(e) => setField('messType', e.target.value as MessType)}
      />
    </div>
  );
}

export function MessLocationFields({ values, errors, setField, disabled }: MessFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <Textarea
        id="address"
        label="Address"
        placeholder="Building, street, area"
        required
        rows={2}
        disabled={disabled}
        value={values.address}
        error={errors.address}
        onChange={(e) => setField('address', e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          id="city"
          label="City"
          required
          disabled={disabled}
          value={values.city}
          error={errors.city}
          onChange={(e) => setField('city', e.target.value)}
        />
        <Select
          id="state"
          label="State"
          placeholder="Select state"
          options={stateOptions}
          required
          disabled={disabled}
          value={values.state}
          error={errors.state}
          onChange={(e) => setField('state', e.target.value)}
        />
        <Input
          id="pincode"
          label="Pincode"
          inputMode="numeric"
          maxLength={6}
          required
          disabled={disabled}
          value={values.pincode}
          error={errors.pincode}
          onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, ''))}
        />
      </div>
    </div>
  );
}

export function MessMealFields({ values, errors, setField, disabled }: MessFieldsProps) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">Meals you serve *</legend>
        <div className="flex flex-wrap gap-x-6">
          <Checkbox
            id="breakfastAvailable"
            label="Breakfast"
            checked={values.breakfastAvailable}
            onChange={(e) => setField('breakfastAvailable', e.target.checked)}
          />
          <Checkbox
            id="lunchAvailable"
            label="Lunch"
            checked={values.lunchAvailable}
            onChange={(e) => setField('lunchAvailable', e.target.checked)}
          />
          <Checkbox
            id="dinnerAvailable"
            label="Dinner"
            checked={values.dinnerAvailable}
            onChange={(e) => setField('dinnerAvailable', e.target.checked)}
          />
        </div>
        {errors.meals && (
          <p role="alert" className="text-sm text-danger">
            {errors.meals}
          </p>
        )}
      </fieldset>

      <fieldset disabled={disabled}>
        <RadioGroup
          name="foodType"
          label="Food served"
          value={values.foodType}
          options={foodTypeOptions}
          onChange={(v) => setField('foodType', v)}
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="openingTime"
          type="time"
          label="Opens at (optional)"
          disabled={disabled}
          value={values.openingTime}
          error={errors.openingTime}
          onChange={(e) => setField('openingTime', e.target.value)}
        />
        <Input
          id="closingTime"
          type="time"
          label="Closes at (optional)"
          disabled={disabled}
          value={values.closingTime}
          error={errors.closingTime}
          onChange={(e) => setField('closingTime', e.target.value)}
        />
      </div>
    </div>
  );
}

const CUTOFF_FIELDS = [
  { key: 'breakfastPauseCutoff', label: 'Breakfast', served: 'breakfastAvailable' },
  { key: 'lunchPauseCutoff', label: 'Lunch', served: 'lunchAvailable' },
  { key: 'dinnerPauseCutoff', label: 'Dinner', served: 'dinnerAvailable' },
] as const;

/** Latest time students can pause a meal for the same day (Indian time). */
export function MessPauseCutoffFields({ values, errors, setField, disabled }: MessFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {CUTOFF_FIELDS.filter((f) => values[f.served]).map((f) => (
        <Input
          key={f.key}
          id={f.key}
          type="time"
          label={`${f.label} — pause before`}
          disabled={disabled}
          value={values[f.key] ?? ''}
          error={errors[f.key]}
          onChange={(e) => setField(f.key, e.target.value)}
        />
      ))}
    </div>
  );
}
