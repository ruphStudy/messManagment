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
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  MESS_SUSPENDED: 'Mess suspended',
  MESS_REACTIVATED: 'Mess reactivated',
  USER_SUSPENDED: 'User suspended',
  USER_REACTIVATED: 'User reactivated',
  ADMIN_LOGIN: 'Admin signed in',
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
