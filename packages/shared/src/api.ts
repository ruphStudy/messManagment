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

export interface MessProfile {
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

export type MessInput = Omit<MessProfile, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'logoUrl'>;
