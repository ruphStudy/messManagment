import type { MessInput } from './api';
import { cityStateError } from './locations';
import { servingTimeErrors, type MealServingTimes } from './meal-times';
import { firstError, isTimeRangeInvalid, LIMITS, MESSAGES, validators } from './validation';

/** Mess form values as typed in a form (text inputs: optional fields are '' rather than null). */
export type MessFormInput = Omit<MessInput, 'email' | 'openingTime' | 'closingTime'> & { email: string; openingTime: string; closingTime: string };

const TIME_KEYS = ['breakfastStart', 'breakfastEnd', 'lunchStart', 'lunchEnd', 'dinnerStart', 'dinnerEnd'] as const;

/**
 * The one client-side mess validation (onboarding + settings, web + mobile). Mirrors the API DTO rules;
 * the API re-checks everything. Returns field → message (undefined = OK).
 */
export function validateMessForm(v: MessFormInput, saved?: { state: string; city: string } | null): Record<string, string | undefined> {
  const timeFormat = Object.fromEntries(TIME_KEYS.filter((k) => v[k] !== undefined).map((k) => [k, validators.required(v[k] ?? '') ?? validators.optionalTime(v[k] ?? '')]));
  const allTimesValid = TIME_KEYS.every((k) => v[k] && !timeFormat[k]);
  const order = allTimesValid ? Object.fromEntries(Object.entries(servingTimeErrors(v as unknown as MealServingTimes)).map(([k, msgs]) => [k, msgs[0]])) : {};
  return {
    ...timeFormat,
    ...order,
    name: firstError(v.name, validators.required, validators.maxLength(LIMITS.messNameMax)),
    mobile: firstError(v.mobile, validators.required, validators.mobile),
    email: validators.optionalEmail(v.email),
    address: firstError(v.address, validators.required, validators.maxLength(LIMITS.addressMax)),
    city: firstError(v.city, validators.required, validators.maxLength(LIMITS.cityMax)) ?? cityStateError(v.state, v.city, saved),
    state: validators.required(v.state) && 'Select a state',
    pincode: firstError(v.pincode, validators.required, validators.pincode),
    meals: v.breakfastAvailable || v.lunchAvailable || v.dinnerAvailable ? undefined : MESSAGES.mealRequired,
    openingTime: validators.optionalTime(v.openingTime),
    breakfastPauseCutoff: v.breakfastPauseCutoff !== undefined ? validators.optionalTime(v.breakfastPauseCutoff) : undefined,
    lunchPauseCutoff: v.lunchPauseCutoff !== undefined ? validators.optionalTime(v.lunchPauseCutoff) : undefined,
    dinnerPauseCutoff: v.dinnerPauseCutoff !== undefined ? validators.optionalTime(v.dinnerPauseCutoff) : undefined,
    closingTime: validators.optionalTime(v.closingTime) ?? (isTimeRangeInvalid(v.openingTime, v.closingTime) ? MESSAGES.timeOrder : undefined),
  };
}

/** Form values → API body (blank optional fields become null). */
export function toMessInputFromForm(v: MessFormInput): MessInput {
  return { ...v, name: v.name.trim(), email: v.email.trim() || null, openingTime: v.openingTime || null, closingTime: v.closingTime || null };
}
