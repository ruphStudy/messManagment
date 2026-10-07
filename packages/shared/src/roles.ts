export const Role = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  MESS_OWNER: 'MESS_OWNER',
  MESS_MANAGER: 'MESS_MANAGER',
  MESS_STAFF: 'MESS_STAFF',
  STUDENT: 'STUDENT',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Roles that a user can hold inside a specific mess (via MessMembership). */
export const MessRole = {
  MESS_OWNER: Role.MESS_OWNER,
  MESS_MANAGER: Role.MESS_MANAGER,
  MESS_STAFF: Role.MESS_STAFF,
  STUDENT: Role.STUDENT,
} as const;
export type MessRole = (typeof MessRole)[keyof typeof MessRole];

/** Roles that sign in to the owner/staff web app with a password. */
export const WEB_ROLES: readonly Role[] = [Role.MESS_OWNER, Role.MESS_MANAGER, Role.MESS_STAFF];
export const MESS_TEAM_ROLES: readonly Role[] = WEB_ROLES;
export const OWNER_OR_MANAGER: readonly Role[] = [Role.MESS_OWNER, Role.MESS_MANAGER];

export const ROLE_LABELS: Record<Role, string> = {
  PLATFORM_ADMIN: 'Platform Admin',
  MESS_OWNER: 'Owner',
  MESS_MANAGER: 'Manager',
  MESS_STAFF: 'Staff',
  STUDENT: 'Student',
};

export const Permission = {
  MESS_CREATE: 'mess:create',
  MESS_VIEW: 'mess:view',
  MESS_UPDATE: 'mess:update',
  STAFF_MANAGE: 'staff:manage',
  STUDENT_VIEW: 'student:view',
  /** Create, edit, activate/deactivate students. */
  STUDENT_MANAGE: 'student:manage',
  STUDENT_IMPORT: 'student:import',
  /** Archive and restore students. */
  STUDENT_ARCHIVE: 'student:archive',
  MEAL_PLAN_VIEW: 'meal-plan:view',
  /** Create, edit, activate/deactivate meal plans. */
  MEAL_PLAN_MANAGE: 'meal-plan:manage',
  SUBSCRIPTION_VIEW: 'subscription:view',
  /** Assign, renew and schedule plan changes. */
  SUBSCRIPTION_MANAGE: 'subscription:manage',
  /** Cancel subscriptions, including immediate plan changes (which cancel the current one). */
  SUBSCRIPTION_CANCEL: 'subscription:cancel',
  MENU_VIEW: 'menu:view',
  /** Create, edit, copy, publish/unpublish menus. */
  MENU_MANAGE: 'menu:manage',
  STUDENT_SELF: 'student:self',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  PLATFORM_ADMIN: [],
  MESS_OWNER: [
    Permission.MESS_CREATE,
    Permission.MESS_VIEW,
    Permission.MESS_UPDATE,
    Permission.STAFF_MANAGE,
    Permission.STUDENT_VIEW,
    Permission.STUDENT_MANAGE,
    Permission.STUDENT_IMPORT,
    Permission.STUDENT_ARCHIVE,
    Permission.MEAL_PLAN_VIEW,
    Permission.MEAL_PLAN_MANAGE,
    Permission.SUBSCRIPTION_VIEW,
    Permission.SUBSCRIPTION_MANAGE,
    Permission.SUBSCRIPTION_CANCEL,
    Permission.MENU_VIEW,
    Permission.MENU_MANAGE,
  ],
  MESS_MANAGER: [
    Permission.MESS_VIEW,
    Permission.MESS_UPDATE,
    Permission.STUDENT_VIEW,
    Permission.STUDENT_MANAGE,
    Permission.STUDENT_IMPORT,
    Permission.MEAL_PLAN_VIEW,
    Permission.MEAL_PLAN_MANAGE,
    Permission.SUBSCRIPTION_VIEW,
    Permission.SUBSCRIPTION_MANAGE,
    Permission.MENU_VIEW,
    Permission.MENU_MANAGE,
  ],
  MESS_STAFF: [
    Permission.MESS_VIEW,
    Permission.STUDENT_VIEW,
    Permission.MEAL_PLAN_VIEW,
    Permission.SUBSCRIPTION_VIEW,
    Permission.MENU_VIEW,
  ],
  STUDENT: [Permission.STUDENT_SELF],
};

export function hasRole(role: Role | null | undefined, allowed: readonly Role[]): boolean {
  return !!role && allowed.includes(role);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].includes(permission);
}
