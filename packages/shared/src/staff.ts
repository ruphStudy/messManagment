import type { MembershipStatus, UserStatus } from './enums';
import type { PaginationQuery } from './api';
import { Role, TEAM_MANAGEABLE_ROLES } from './roles';

/** Roles that can be assigned through staff management (never owner, admin or student). */
export const STAFF_ASSIGNABLE_ROLES = [Role.MESS_MANAGER, Role.MESS_STAFF] as const;
export type StaffRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

export const STAFF_ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  MESS_MANAGER: 'Can manage day-to-day mess operations: students, plans, menus, payments, expenses and reports.',
  MESS_STAFF: 'Can serve meals (QR scan / manual) and view operational information like menus, students and pauses.',
};

/** Membership status shown as Active / Inactive (REMOVED = deactivated, history kept). */
export type StaffStatus = 'ACTIVE' | 'INACTIVE';
export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive' };

/** What the signed-in user may do with this team member (same rule the API enforces). */
export interface StaffActions {
  edit: boolean;
  changeRole: boolean;
  setStatus: boolean;
  resetPassword: boolean;
}

export interface StaffListItem {
  /** User id (stable across messes). */
  id: string;
  membershipId: string;
  firstName: string;
  lastName: string | null;
  mobile: string;
  email: string | null;
  role: Role;
  status: StaffStatus;
  /** Account-level status (platform suspension). */
  accountStatus: UserStatus;
  addedAt: string;
  lastLoginAt: string | null;
  isSelf: boolean;
  actions: StaffActions;
}

export interface StaffDetail extends StaffListItem {
  membershipStatus: MembershipStatus;
  mustChangePassword: boolean;
  updatedAt: string;
  /** Roles this user may be given by the signed-in user. */
  assignableRoles: StaffRole[];
}

export interface StaffListQuery extends PaginationQuery {
  search?: string;
  role?: StaffRole | 'MESS_OWNER';
  status?: StaffStatus;
}

export interface CreateStaffRequest {
  firstName: string;
  lastName?: string | null;
  mobile: string;
  email?: string | null;
  role: StaffRole;
  /** Temporary password for a new account; ignored when an existing team account is reused. */
  temporaryPassword?: string;
}

export interface CreateStaffResult {
  staff: StaffDetail;
  /** An existing account was linked (it keeps its own password). */
  reusedAccount: boolean;
}

/** Name/email/role. Mobile is the login id and is not changed here. */
export interface UpdateStaffRequest {
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  role?: StaffRole;
}

export interface SetStaffStatusRequest {
  status: StaffStatus;
}

export interface ResetStaffPasswordRequest {
  temporaryPassword: string;
}

/** Same rule as the API: hierarchy + never yourself + never an owner. */
export function staffActionsFor(actor: { userId: string; role: Role | null | undefined }, target: { userId: string; role: Role }): StaffActions {
  const allowed = !!actor.role && actor.userId !== target.userId && TEAM_MANAGEABLE_ROLES[actor.role].includes(target.role);
  return {
    edit: allowed,
    changeRole: allowed && STAFF_ASSIGNABLE_ROLES.filter((r) => TEAM_MANAGEABLE_ROLES[actor.role!].includes(r)).length > 1,
    setStatus: allowed,
    resetPassword: allowed,
  };
}
