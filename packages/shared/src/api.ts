import type { FoodType, MembershipStatus, MessStatus, MessType, UserStatus } from './enums';
import type { MessRole, Role } from './roles';

export const API_PREFIX = '/api/v1';

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  WRONG_APP: 'WRONG_APP',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_COOLDOWN: 'OTP_COOLDOWN',
  MESS_ALREADY_EXISTS: 'MESS_ALREADY_EXISTS',
  MESS_REQUIRED: 'MESS_REQUIRED',
  STUDENT_DUPLICATE: 'STUDENT_DUPLICATE',
  STUDENT_ARCHIVED: 'STUDENT_ARCHIVED',
  MOBILE_IN_USE: 'MOBILE_IN_USE',
  STUDENT_NOT_LINKED: 'STUDENT_NOT_LINKED',
  FILE_INVALID: 'FILE_INVALID',
  PLAN_NAME_TAKEN: 'PLAN_NAME_TAKEN',
  PLAN_INACTIVE: 'PLAN_INACTIVE',
  STUDENT_NOT_ACTIVE: 'STUDENT_NOT_ACTIVE',
  SUBSCRIPTION_OVERLAP: 'SUBSCRIPTION_OVERLAP',
  SUBSCRIPTION_NOT_CHANGEABLE: 'SUBSCRIPTION_NOT_CHANGEABLE',
  MENU_EXISTS: 'MENU_EXISTS',
  QR_INVALID: 'QR_INVALID',
  QR_EXPIRED: 'QR_EXPIRED',
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  NO_ACTIVE_SUBSCRIPTION: 'NO_ACTIVE_SUBSCRIPTION',
  MEAL_NOT_INCLUDED: 'MEAL_NOT_INCLUDED',
  NO_MEAL_CREDITS: 'NO_MEAL_CREDITS',
  ALREADY_SERVED: 'ALREADY_SERVED',
  ATTENDANCE_NOT_FOUND: 'ATTENDANCE_NOT_FOUND',
  ATTENDANCE_ALREADY_REVERSED: 'ATTENDANCE_ALREADY_REVERSED',
  MEAL_PAUSED: 'MEAL_PAUSED',
  PAUSE_CUTOFF_PASSED: 'PAUSE_CUTOFF_PASSED',
  PAUSE_DATE_PAST: 'PAUSE_DATE_PAST',
  PAUSE_ALREADY_EXISTS: 'PAUSE_ALREADY_EXISTS',
  PAUSE_NOT_FOUND: 'PAUSE_NOT_FOUND',
  PAUSE_ALREADY_CANCELLED: 'PAUSE_ALREADY_CANCELLED',
  ATTENDANCE_ALREADY_SERVED: 'ATTENDANCE_ALREADY_SERVED',
  PAYMENT_AMOUNT_INVALID: 'PAYMENT_AMOUNT_INVALID',
  PAYMENT_EXCEEDS_BALANCE: 'PAYMENT_EXCEEDS_BALANCE',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_ALREADY_REVERSED: 'PAYMENT_ALREADY_REVERSED',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  NO_OUTSTANDING_BALANCE: 'NO_OUTSTANDING_BALANCE',
  EXPENSE_AMOUNT_INVALID: 'EXPENSE_AMOUNT_INVALID',
  EXPENSE_NOT_FOUND: 'EXPENSE_NOT_FOUND',
  EXPENSE_ALREADY_REVERSED: 'EXPENSE_ALREADY_REVERSED',
  EXPENSE_CATEGORY_NOT_FOUND: 'EXPENSE_CATEGORY_NOT_FOUND',
  EXPENSE_CATEGORY_INACTIVE: 'EXPENSE_CATEGORY_INACTIVE',
  EXPENSE_CATEGORY_EXISTS: 'EXPENSE_CATEGORY_EXISTS',
  EXPENSE_DATE_INVALID: 'EXPENSE_DATE_INVALID',
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  PUSH_TOKEN_INVALID: 'PUSH_TOKEN_INVALID',
  REMINDER_NOT_ALLOWED: 'REMINDER_NOT_ALLOWED',
  FEEDBACK_NOT_ALLOWED: 'FEEDBACK_NOT_ALLOWED',
  FEEDBACK_ALREADY_SUBMITTED: 'FEEDBACK_ALREADY_SUBMITTED',
  RATING_INVALID: 'RATING_INVALID',
  COMPLAINT_NOT_FOUND: 'COMPLAINT_NOT_FOUND',
  COMPLAINT_ALREADY_RESOLVED: 'COMPLAINT_ALREADY_RESOLVED',
  COMPLAINT_STATUS_INVALID: 'COMPLAINT_STATUS_INVALID',
  ATTACHMENT_INVALID: 'ATTACHMENT_INVALID',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode | string;
    message: string;
    /** Field-level validation errors keyed by field name. */
    fields?: Record<string, string[]>;
  };
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string | null;
  mobile: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  mobileVerified: boolean;
}

export interface MembershipSummary {
  id: string;
  role: MessRole;
  status: MembershipStatus;
  mess: { id: string; name: string };
}

/** Current user plus the mess they are working in (if any). */
export interface AuthContext {
  user: AuthUser;
  membership: MembershipSummary | null;
  /** Effective role for authorization: the membership role if present, else the user's role. */
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  /** Only returned to mobile clients. Web receives it as an httpOnly cookie. */
  refreshToken?: string;
}

export type AuthResponse = AuthContext & AuthTokens;

export interface RegisterOwnerRequest {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface RequestOtpRequest {
  mobile: string;
}

export interface RequestOtpResponse {
  expiresIn: number;
  resendIn: number;
  /** Present only in local development when OTP echo is enabled. */
  devOtp?: string;
}

export interface VerifyOtpRequest {
  mobile: string;
  code: string;
}

export interface MessPauseCutoffs {
  /** HH:mm — same-day pauses must be made before this time. */
  breakfastPauseCutoff: string;
  lunchPauseCutoff: string;
  dinnerPauseCutoff: string;
}

export interface MessProfile extends MessPauseCutoffs {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  messType: MessType;
  foodType: FoodType;
  address: string;
  city: string;
  state: string;
  pincode: string;
  breakfastAvailable: boolean;
  lunchAvailable: boolean;
  dinnerAvailable: boolean;
  openingTime: string | null;
  closingTime: string | null;
  logoUrl: string | null;
  status: MessStatus;
  createdAt: string;
  updatedAt: string;
}

export type MessInput = Omit<MessProfile, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'logoUrl' | keyof MessPauseCutoffs> &
  Partial<MessPauseCutoffs>;
