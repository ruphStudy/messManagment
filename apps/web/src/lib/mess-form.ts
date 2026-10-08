import {
  FoodType,
  firstError,
  isTimeRangeInvalid,
  LIMITS,
  MESSAGES,
  MessType,
  servingTimeErrors,
  validators,
  type MealServingTimes,
  type MessInput,
  type MessProfile,
} from '@mess/shared';
import type { FieldErrors } from './use-form';

export type MessFormValues = Omit<MessInput, 'email' | 'openingTime' | 'closingTime'> & {
  email: string;
  openingTime: string;
  closingTime: string;
};

export const MESS_SECTIONS = {
  basic: ['name', 'mobile', 'email', 'messType'],
  location: ['address', 'city', 'state', 'pincode'],
  meals: ['foodType', 'meals', 'openingTime', 'closingTime'],
} as const;

export function emptyMessForm(defaults: Partial<MessFormValues> = {}): MessFormValues {
  return {
    name: '',
    mobile: '',
    email: '',
    messType: MessType.STUDENT_MESS,
    foodType: FoodType.VEG,
    address: '',
    city: '',
    state: '',
    pincode: '',
    breakfastAvailable: false,
    lunchAvailable: true,
    dinnerAvailable: true,
    openingTime: '',
    closingTime: '',
    ...defaults,
  };
}

export function messToForm(mess: MessProfile): MessFormValues {
  const { id: _id, status: _status, createdAt: _c, updatedAt: _u, logoUrl: _logo, ...rest } = mess;
  return { ...rest, email: mess.email ?? '', openingTime: mess.openingTime ?? '', closingTime: mess.closingTime ?? '' };
}

const TIME_KEYS = ['breakfastStart', 'breakfastEnd', 'lunchStart', 'lunchEnd', 'dinnerStart', 'dinnerEnd'] as const;

export function validateMess(v: MessFormValues): FieldErrors<MessFormValues> {
  const timeFormat = Object.fromEntries(TIME_KEYS.filter((k) => v[k] !== undefined).map((k) => [k, validators.required(v[k] ?? '') ?? validators.optionalTime(v[k] ?? '')]));
  const allTimesValid = TIME_KEYS.every((k) => v[k] && !timeFormat[k]);
  const order = allTimesValid ? Object.fromEntries(Object.entries(servingTimeErrors(v as MealServingTimes)).map(([k, msgs]) => [k, msgs[0]])) : {};
  return {
    ...timeFormat,
    ...order,
    name: firstError(v.name, validators.required, validators.maxLength(LIMITS.messNameMax)),
    mobile: firstError(v.mobile, validators.required, validators.mobile),
    email: validators.optionalEmail(v.email),
    address: firstError(v.address, validators.required, validators.maxLength(LIMITS.addressMax)),
    city: firstError(v.city, validators.required, validators.maxLength(LIMITS.cityMax)),
    state: validators.required(v.state) && 'Select a state',
    pincode: firstError(v.pincode, validators.required, validators.pincode),
    meals: v.breakfastAvailable || v.lunchAvailable || v.dinnerAvailable ? undefined : MESSAGES.mealRequired,
    openingTime: validators.optionalTime(v.openingTime),
    breakfastPauseCutoff: v.breakfastPauseCutoff !== undefined ? validators.optionalTime(v.breakfastPauseCutoff) : undefined,
    lunchPauseCutoff: v.lunchPauseCutoff !== undefined ? validators.optionalTime(v.lunchPauseCutoff) : undefined,
    dinnerPauseCutoff: v.dinnerPauseCutoff !== undefined ? validators.optionalTime(v.dinnerPauseCutoff) : undefined,
    closingTime:
      validators.optionalTime(v.closingTime) ??
      (isTimeRangeInvalid(v.openingTime, v.closingTime) ? MESSAGES.timeOrder : undefined),
  };
}

export function toMessInput(v: MessFormValues): MessInput {
  return {
    ...v,
    name: v.name.trim(),
    email: v.email.trim() || null,
    openingTime: v.openingTime || null,
    closingTime: v.closingTime || null,
  };
}
