import type { FoodType, MembershipStatus, MessStatus, MessType, UserStatus } from './enums';
import type { MessRole, Role } from './roles';
import type { StudentStatus } from './students';
import type { MealServingTimes } from './meal-times';
import type { PlatformSubscriptionStatus } from './admin';

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
  REPORT_RANGE_TOO_LARGE: 'REPORT_RANGE_TOO_LARGE',
  EXPORT_TOO_LARGE: 'EXPORT_TOO_LARGE',
  MESS_SUSPENDED: 'MESS_SUSPENDED',
  ADMIN_ACTION_NOT_ALLOWED: 'ADMIN_ACTION_NOT_ALLOWED',
  STAFF_NOT_FOUND: 'STAFF_NOT_FOUND',
  STAFF_ALREADY_EXISTS: 'STAFF_ALREADY_EXISTS',
  STAFF_ROLE_INVALID: 'STAFF_ROLE_INVALID',
  STAFF_CANNOT_MODIFY_OWNER: 'STAFF_CANNOT_MODIFY_OWNER',
  STAFF_CANNOT_MODIFY_SELF: 'STAFF_CANNOT_MODIFY_SELF',
  STAFF_ACCOUNT_DISABLED: 'STAFF_ACCOUNT_DISABLED',
  PASSWORD_INCORRECT: 'PASSWORD_INCORRECT',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  /** Public signup with a mobile/email that already has an account: sign in instead. */
  ACCOUNT_EXISTS: 'ACCOUNT_EXISTS',
  /** MessMate subscription not active (pending payment / expired / suspended): mess changes blocked; viewing allowed. */
  PLATFORM_SUBSCRIPTION_REQUIRED: 'PLATFORM_SUBSCRIPTION_REQUIRED',
  PLAN_REQUEST_PENDING: 'PLAN_REQUEST_PENDING',
  PLAN_REQUEST_NOT_FOUND: 'PLAN_REQUEST_NOT_FOUND',
  /** Student linked to several usable messes and no x-mess-id sent: the client must pick one. */
  STUDENT_MESS_SELECTION_REQUIRED: 'STUDENT_MESS_SELECTION_REQUIRED',
  /** x-mess-id is not one of this student's messes (or the record was archived). */
  STUDENT_MESS_NOT_AVAILABLE: 'STUDENT_MESS_NOT_AVAILABLE',
  /** OTP sign-in requested for an account that signs in with a password (owner/manager/staff/admin). */
  PASSWORD_SIGN_IN_REQUIRED: 'PASSWORD_SIGN_IN_REQUIRED',
  /** Password sign-in attempted for a student account (students sign in with an OTP on any device). */
  OTP_SIGN_IN_REQUIRED: 'OTP_SIGN_IN_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
  /** Report totals for the whole filtered set (not just this page). */
  summary?: unknown;
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
  /** A temporary password was set by the mess; the web app asks for a new one first. */
  mustChangePassword: boolean;
}

export interface MembershipSummary {
  id: string;
  role: MessRole;
  status: MembershipStatus;
  /** SUSPENDED: the platform paused this mess — records stay readable, changes are blocked. */
  mess: { id: string; name: string; status: MessStatus };
}

/** One mess a student account is linked to (one student record per mess). */
export interface StudentMessMembership {
  studentId: string;
  messId: string;
  messName: string;
  status: StudentStatus;
  messStatus: MessStatus;
  /** ACTIVE record in an ACTIVE mess: selectable for normal use. */
  usable: boolean;
}

/**
 * A student account's links to mess records (made by verified mobile when a mess adds it). A student may
 * belong to several messes at once; the client keeps the current one and sends it as `x-mess-id`.
 */
export interface StudentLinkContext {
  linked: boolean;
  /** Non-archived records, usable first. */
  memberships: StudentMessMembership[];
  /** The mess the server picks without a selection: the only usable one, else null (choose). */
  defaultMessId: string | null;
  /** Back-compat: the default mess (null when none or a choice is needed). */
  mess: { id: string; name: string; status: MessStatus } | null;
}

/** Header carrying the student's selected mess on student self-service requests (verified server-side). */
export const STUDENT_MESS_HEADER = 'x-mess-id';

/**
 * Which mess the student app should use: the saved one if still a membership, else the only usable one,
 * else null (show the chooser when there are several, or the waiting state when none).
 */
export function pickStudentMess(ctx: StudentLinkContext | null | undefined, saved: string | null): { messId: string | null; needsChoice: boolean } {
  if (!ctx?.linked) return { messId: null, needsChoice: false };
  const memberships = studentMemberships(ctx);
  if (saved && memberships.some((m) => m.messId === saved)) return { messId: saved, needsChoice: false };
  const usable = memberships.filter((m) => m.usable);
  if (usable.length === 1) return { messId: usable[0].messId, needsChoice: false };
  if (usable.length > 1) return { messId: null, needsChoice: true };
  // Nothing usable (inactive record / suspended mess): use the only record for read-only history, else choose.
  return memberships.length === 1 ? { messId: memberships[0].messId, needsChoice: false } : { messId: null, needsChoice: memberships.length > 1 };
}

/**
 * All of the student's messes from a session. Tolerates a response from an API build that predates multi-mess
 * (only `student.mess`): then that single mess is the list, never a crash.
 */
export function studentMemberships(ctx: StudentLinkContext | null | undefined): StudentMessMembership[] {
  if (!ctx?.linked) return [];
  if (Array.isArray(ctx.memberships)) return ctx.memberships;
  return ctx.mess ? [{ studentId: '', messId: ctx.mess.id, messName: ctx.mess.name, status: 'ACTIVE', messStatus: ctx.mess.status, usable: ctx.mess.status === 'ACTIVE' }] : [];
}

/**
 * Current user plus the mess they are working in (if any). Role decides permissions, never the device:
 * any role may sign in from web or mobile; clients only choose what to show.
 */
export interface AuthContext {
  user: AuthUser;
  membership: MembershipSummary | null;
  /** Student accounts only (null otherwise); returned by /auth/me and sign-in responses. */
  student?: StudentLinkContext | null;
  /** Team members only: MessMate (SaaS) access of their mess. Rechecked on /auth/me, sign-in and refresh. */
  billing?: { status: PlatformSubscriptionStatus; accessAllowed: boolean; accessUntil: string | null } | null;
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

export interface MessProfile extends MessPauseCutoffs, MealServingTimes {
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

export type MessInput = Omit<MessProfile, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'logoUrl' | keyof MessPauseCutoffs | keyof MealServingTimes> &
  Partial<MessPauseCutoffs> &
  Partial<MealServingTimes>;

/** Operational settings owners and managers can change (PATCH /mess/settings). Profile fields stay owner-only. */
export const MESS_SETTINGS_FIELDS = [
  'breakfastAvailable',
  'lunchAvailable',
  'dinnerAvailable',
  'openingTime',
  'closingTime',
  'breakfastStart',
  'breakfastEnd',
  'lunchStart',
  'lunchEnd',
  'dinnerStart',
  'dinnerEnd',
  'breakfastPauseCutoff',
  'lunchPauseCutoff',
  'dinnerPauseCutoff',
] as const satisfies readonly (keyof MessProfile)[];
export type MessSettingsInput = Partial<Pick<MessProfile, (typeof MESS_SETTINGS_FIELDS)[number]>>;

// ── Own account ──

export interface UpdateAccountRequest {
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Forgot password (team accounts): OTP to the registered mobile, then a new password. */
export interface PasswordResetRequest {
  mobile: string;
}
export interface PasswordResetConfirm {
  mobile: string;
  code: string;
  newPassword: string;
}

/**
 * Fixed, user-friendly wording for account/session-level errors shown by web and mobile.
 * Other codes keep the server message, which is already written for users and carries specifics
 * (e.g. which meal, how many credits). Never shows stack traces or internal details.
 */
export const FRIENDLY_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  MESS_SUSPENDED: 'This mess is temporarily unavailable. You can view records, but changes are paused. Please contact support.',
  PASSWORD_CHANGE_REQUIRED: 'Please set a new password to continue.',
  PLATFORM_SUBSCRIPTION_REQUIRED: 'Your MessMate subscription is not active. You can view records; contact support to activate or renew.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

export function friendlyErrorMessage(code: string | undefined, serverMessage: string | undefined): string {
  return (code && FRIENDLY_ERROR_MESSAGES[code as ErrorCode]) || serverMessage || 'Something went wrong. Please try again.';
}

// ── Public signup ──

/**
 * The only two self-signup choices. This is an intent, not a role: the API decides what is created.
 * OWNER → a MESS_OWNER account that can only own a NEW mess it creates (onboarding);
 * STUDENT → an OTP-verified account linked to mess records that match its mobile.
 * Managers/staff are added by their mess; platform admins are internal.
 */
export const SignupIntent = { OWNER: 'OWNER', STUDENT: 'STUDENT' } as const;
export type SignupIntent = (typeof SignupIntent)[keyof typeof SignupIntent];
