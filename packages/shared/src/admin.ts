import type { ComplaintCounts, ComplaintDetail, ComplaintListItem } from './feedback';
import type { FinanceMonthlySummary } from './expenses';
import type { FoodType, MembershipStatus, MessStatus, MessType, UserStatus } from './enums';
import type { MealKey } from './menus';
import type { PaginationQuery } from './api';
import type { ReportType } from './reports';
import type { Role } from './roles';
import type { StudentStatus } from './students';

// ── Audit ──

export const AuditAction = {
  MESS_SUSPENDED: 'MESS_SUSPENDED',
  MESS_REACTIVATED: 'MESS_REACTIVATED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  BILLING_TRIAL_GRANTED: 'BILLING_TRIAL_GRANTED',
  BILLING_ACTIVATED: 'BILLING_ACTIVATED',
  BILLING_STATUS_CHANGED: 'BILLING_STATUS_CHANGED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  MESS_SUSPENDED: 'Mess suspended',
  MESS_REACTIVATED: 'Mess reactivated',
  USER_SUSPENDED: 'User suspended',
  USER_REACTIVATED: 'User reactivated',
  ADMIN_LOGIN: 'Admin signed in',
  BILLING_TRIAL_GRANTED: 'MessMate trial granted',
  BILLING_ACTIVATED: 'MessMate subscription activated',
  BILLING_STATUS_CHANGED: 'MessMate subscription status changed',
};

export const AuditTargetType = { MESS: 'MESS', USER: 'USER' } as const;
export type AuditTargetType = (typeof AuditTargetType)[keyof typeof AuditTargetType];

export interface AuditLogItem {
  id: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  /** Name of the mess/user at the time of the action. */
  targetLabel: string | null;
  mess: { id: string; name: string } | null;
  actor: { id: string; name: string };
  reason: string | null;
  createdAt: string;
}

export interface AuditListQuery extends PaginationQuery {
  actorUserId?: string;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  messId?: string;
  from?: string;
  to?: string;
}

/** Reason is required for suspensions, optional for reactivations. */
export interface AdminStatusChangeRequest {
  reason?: string;
}
export const ADMIN_REASON_MAX = 500;

// ── Dashboard ──

export interface AdminDashboard {
  dates: { today: string; month: string };
  messes: { total: number; active: number; suspended: number; newThisMonth: number };
  /** Accounts by role (students are app accounts, see `students` for mess records). */
  users: { owners: number; managers: number; staff: number; studentAccounts: number; disabled: number };
  students: { total: number; active: number; unlinked: number; newThisMonth: number };
  usage: {
    mealsServedToday: number;
    mealsServedLast7Days: number;
    /** Messes that served at least one meal. */
    activeMessesToday: number;
    activeMessesLast7Days: number;
    activeSubscriptions: number;
    totalSubscriptions: number;
    expiringSubscriptions: number;
    paymentsThisMonth: { count: number; amountPaise: number };
  };
  complaints: { open: number; inProgress: number; newLast7Days: number; newPrevious7Days: number };
  notifications: { pushFailedLast7Days: number; activeDevices: number };
}

// ── Messes ──

export interface AdminMessListItem {
  id: string;
  name: string;
  city: string;
  state: string;
  messType: MessType;
  status: MessStatus;
  createdAt: string;
  owner: { id: string; name: string; mobile: string; email: string | null };
  activeStudents: number;
  /** Effective MessMate (SaaS) subscription status. */
  billingStatus: PlatformSubscriptionStatus;
}

export const ADMIN_MESS_SORT_FIELDS = ['createdAt', 'name', 'city'] as const;
export type AdminMessSortField = (typeof ADMIN_MESS_SORT_FIELDS)[number];

export interface AdminMessListQuery extends PaginationQuery {
  search?: string;
  status?: MessStatus;
  city?: string;
  messType?: MessType;
  from?: string;
  to?: string;
  sortBy?: AdminMessSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminMessDetail {
  mess: {
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
    openingTime: string | null;
    closingTime: string | null;
    meals: Record<MealKey, boolean>;
    status: MessStatus;
    createdAt: string;
    updatedAt: string;
  };
  owner: { id: string; name: string; mobile: string; email: string | null; status: UserStatus; lastLoginAt: string | null };
  /** Latest suspension, while suspended. */
  suspension: { reason: string | null; at: string; by: string } | null;
  team: { id: string; name: string; role: Role; status: MembershipStatus }[];
  students: { total: number; active: number; inactive: number; appLinked: number };
  subscriptions: { active: number; expiringSoon: number };
  attendance: { today: Record<MealKey, number> & { total: number }; last7Days: number };
  finance: FinanceMonthlySummary;
  complaints: ComplaintCounts;
  recentActivity: AuditLogItem[];
}

/** Read-only record views an admin can open for one mess (same data as the owner's reports). */
export const ADMIN_RECORD_TYPES = ['students', 'subscriptions', 'attendance', 'payments', 'complaints'] as const satisfies readonly ReportType[];
export type AdminRecordType = (typeof ADMIN_RECORD_TYPES)[number];

// ── Users ──

export interface AdminUserMessLink {
  messId: string;
  messName: string;
  /** Team role, or STUDENT for a student record. */
  role: Role;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  messes: AdminUserMessLink[];
}

export interface AdminUserListQuery extends PaginationQuery {
  search?: string;
  role?: Role;
  status?: UserStatus;
  messId?: string;
  from?: string;
  to?: string;
}

export interface AdminUserDetail {
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    mobile: string;
    email: string | null;
    role: Role;
    status: UserStatus;
    mobileVerified: boolean;
    emailVerified: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  memberships: { messId: string; messName: string; messStatus: MessStatus; role: Role; status: MembershipStatus; since: string }[];
  ownedMesses: { id: string; name: string; status: MessStatus }[];
  studentRecords: { id: string; messId: string; messName: string; status: StudentStatus; joiningDate: string }[];
  /** Latest suspension, while suspended. */
  suspension: { reason: string | null; at: string; by: string } | null;
  /** Platform admins and your own account cannot be suspended here. */
  canChangeStatus: boolean;
  recentActivity: AuditLogItem[];
}

// ── Complaints ──

export type AdminComplaintItem = ComplaintListItem & { mess: { id: string; name: string } };
/** Read-only; the photo itself is not exposed to the admin portal. */
export type AdminComplaintDetail = Omit<ComplaintDetail, 'attachmentId'> & { mess: { id: string; name: string } };

// ── System ──

export interface SystemStatus {
  environment: string;
  version: string;
  uptimeSeconds: number;
  checkedAt: string;
  database: { reachable: boolean; latencyMs: number | null };
  push: { provider: 'expo' | 'log' | 'disabled'; accessTokenConfigured: boolean };
  sms: { provider: string };
  scheduler: { enabled: boolean };
  storage: { provider: 'local'; warning: string | null };
  notifications: { total: number; pushFailedLast7Days: number; activeDevices: number };
}

// ── MessMate (SaaS) subscription for a mess — not student meal plans ──

export const PlatformSubscriptionStatus = { PENDING_PAYMENT: 'PENDING_PAYMENT', TRIAL: 'TRIAL', ACTIVE: 'ACTIVE', EXPIRED: 'EXPIRED', SUSPENDED: 'SUSPENDED' } as const;
export type PlatformSubscriptionStatus = (typeof PlatformSubscriptionStatus)[keyof typeof PlatformSubscriptionStatus];
export const PLATFORM_SUBSCRIPTION_STATUS_LABELS: Record<PlatformSubscriptionStatus, string> = {
  PENDING_PAYMENT: 'Pending payment',
  TRIAL: 'Trial',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
};
export const BillingCycle = { MONTHLY: 'MONTHLY', YEARLY: 'YEARLY' } as const;
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];
export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = { MONTHLY: 'Monthly', YEARLY: 'Yearly' };
export const PLATFORM_TRIAL_DAYS = 15;

export interface PlatformSubscriptionRecord {
  id: string;
  status: PlatformSubscriptionStatus;
  planName: string;
  billingCycle: BillingCycle | null;
  amountPaise: number;
  startDate: string | null;
  endDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
}

/**
 * What the owner app / admin shows, resolved by business date (inclusive): `current` is the period covering today
 * (or, with no access, the latest ended period / admin status row); renewals that start later are in `upcoming`.
 */
export interface PlatformBillingSummary {
  status: PlatformSubscriptionStatus;
  /** Mess operations (changes) allowed: ACTIVE within the paid period, or TRIAL within the trial. */
  accessAllowed: boolean;
  /** Last day of access (paid end or trial end), if any. */
  accessUntil: string | null;
  daysRemaining: number | null;
  current: PlatformSubscriptionRecord | null;
  /** Paid renewals/trials whose start date is after today, earliest first. */
  upcoming: PlatformSubscriptionRecord[];
  /** Optional support contact from server config (no hardcoded numbers). */
  support: { email: string | null; phone: string | null };
}

export type BillingRecordPhase = 'CURRENT' | 'UPCOMING' | 'PAST';
export interface AdminBillingDetail extends PlatformBillingSummary {
  /** Every recorded change, newest first. */
  history: (PlatformSubscriptionRecord & { phase: BillingRecordPhase })[];
}

export interface GrantTrialRequest {
  notes?: string;
}
export interface ActivatePlatformSubscriptionRequest {
  planName: string;
  billingCycle: BillingCycle;
  amountPaise: number;
  /** Defaults to the day after current access ends (renewal) or today. */
  startDate?: string;
  /** Defaults to start + 1 month / 1 year − 1 day. */
  endDate?: string;
  paymentReference?: string;
  notes?: string;
}
export interface PlatformStatusChangeRequest {
  status: 'EXPIRED' | 'SUSPENDED';
  notes?: string;
}

export const PLATFORM_SUBSCRIPTION_INACTIVE_MESSAGE = 'Your MessMate subscription is not active. Contact support to activate or renew.';

/** One headline + tone for the owner Billing screen (web and mobile). */
export function billingHeadline(s: PlatformBillingSummary, formatDate: (date: string) => string): { text: string; tone: 'success' | 'warning' | 'danger' } {
  if (s.accessAllowed && s.status === PlatformSubscriptionStatus.TRIAL) {
    return { text: `Trial active · ${s.daysRemaining} day${s.daysRemaining === 1 ? '' : 's'} remaining`, tone: 'warning' };
  }
  if (s.accessAllowed && s.accessUntil) return { text: `Subscription active until ${formatDate(s.accessUntil)}`, tone: 'success' };
  return { text: PLATFORM_SUBSCRIPTION_INACTIVE_MESSAGE, tone: 'danger' };
}

/** "Yearly · ₹12,000.00 · 10 Nov 2026 – 9 Nov 2027" for an upcoming renewal/trial. */
export function billingPeriodLabel(r: PlatformSubscriptionRecord, formatDate: (date: string) => string, formatMoney: (paise: number) => string): string {
  const from = r.status === PlatformSubscriptionStatus.TRIAL ? r.trialStartDate : r.startDate;
  const to = r.status === PlatformSubscriptionStatus.TRIAL ? r.trialEndDate : r.endDate;
  return [r.billingCycle ? BILLING_CYCLE_LABELS[r.billingCycle] : null, r.amountPaise ? formatMoney(r.amountPaise) : null, from && to ? `${formatDate(from)} – ${formatDate(to)}` : null]
    .filter(Boolean)
    .join(' · ');
}
