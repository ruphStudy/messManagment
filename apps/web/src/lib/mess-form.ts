import {
  FoodType,
  MessType,
  toMessInputFromForm,
  validateMessForm,
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

/** Shared with mobile onboarding (one rule set): see validateMessForm in @mess/shared. */
export function validateMess(v: MessFormValues, saved?: { state: string; city: string } | null): FieldErrors<MessFormValues> {
  return validateMessForm(v, saved);
}

export function toMessInput(v: MessFormValues): MessInput {
  return toMessInputFromForm(v);
}
