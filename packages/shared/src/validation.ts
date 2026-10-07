/** Shared validation rules. The backend is authoritative; clients use these for instant feedback. */

export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const PINCODE_REGEX = /^[1-9]\d{5}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;
export const OTP_LENGTH = 6;
export const DEFAULT_COUNTRY_CODE = '+91';

export const LIMITS = {
  nameMax: 50,
  messNameMax: 80,
  emailMax: 120,
  addressMax: 200,
  cityMax: 60,
  passwordMin: 8,
  passwordMax: 64,
} as const;

export const MESSAGES = {
  required: 'This field is required',
  mobile: 'Enter a valid 10-digit mobile number',
  email: 'Enter a valid email address',
  password: 'Use at least 8 characters with a letter and a number',
  passwordMismatch: 'Passwords do not match',
  pincode: 'Enter a valid 6-digit pincode',
  time: 'Enter time as HH:MM',
  timeOrder: 'Closing time must be after opening time',
  otp: `Enter the ${OTP_LENGTH}-digit code`,
  mealRequired: 'Select at least one meal',
} as const;

type Check = (value: string) => string | undefined;

export const validators = {
  required: (v: string) => (v.trim() ? undefined : MESSAGES.required),
  mobile: (v: string) => (MOBILE_REGEX.test(v.trim()) ? undefined : MESSAGES.mobile),
  email: (v: string) => (EMAIL_REGEX.test(v.trim()) ? undefined : MESSAGES.email),
  optionalEmail: (v: string) => (!v.trim() || EMAIL_REGEX.test(v.trim()) ? undefined : MESSAGES.email),
  password: (v: string) => (PASSWORD_REGEX.test(v) ? undefined : MESSAGES.password),
  pincode: (v: string) => (PINCODE_REGEX.test(v.trim()) ? undefined : MESSAGES.pincode),
  optionalTime: (v: string) => (!v || TIME_REGEX.test(v) ? undefined : MESSAGES.time),
  otp: (v: string) => (new RegExp(`^\\d{${OTP_LENGTH}}$`).test(v) ? undefined : MESSAGES.otp),
  maxLength:
    (max: number): Check =>
    (v: string) =>
      v.length <= max ? undefined : `Keep this under ${max} characters`,
};

/** Runs checks in order and returns the first error. */
export function firstError(value: string, ...checks: Check[]): string | undefined {
  for (const check of checks) {
    const error = check(value);
    if (error) return error;
  }
  return undefined;
}

/** True when both times are set and closing is not after opening. */
export function isTimeRangeInvalid(opening?: string | null, closing?: string | null): boolean {
  return !!opening && !!closing && closing <= opening;
}

/** Accepts an email or a 10-digit mobile number as a login identifier. */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}
