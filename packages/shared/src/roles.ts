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
  ATTENDANCE_VIEW: 'attendance:view',
  /** Scan QR and mark attendance manually. */
  ATTENDANCE_MARK: 'attendance:mark',
  /** Reverse a served meal (restores the credit). */
  ATTENDANCE_REVERSE: 'attendance:reverse',
  PAUSE_VIEW: 'pause:view',
  /** Add or cancel pauses for students. */
  PAUSE_MANAGE: 'pause:manage',
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_RECORD: 'payment:record',
  PAYMENT_REVERSE: 'payment:reverse',
  /** Expenses and the revenue-vs-expense estimate are owner/manager only (staff have no access). */
  EXPENSE_VIEW: 'expense:view',
  /** Add, edit, reverse expenses and manage categories. */
  EXPENSE_MANAGE: 'expense:manage',
  FINANCE_VIEW: 'finance:view',
  /** Send payment/manual reminders and run expiry reminders. Staff cannot. */
  REMINDER_SEND: 'reminder:send',
  /** Ratings and general feedback (owner/manager). */
  FEEDBACK_VIEW: 'feedback:view',
  /** Complaint queue: staff can view. */
  COMPLAINT_VIEW: 'complaint:view',
  /** Change complaint status and reply (owner/manager). */
  COMPLAINT_MANAGE: 'complaint:manage',
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
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_REVERSE,
    Permission.PAUSE_VIEW,
    Permission.PAUSE_MANAGE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_RECORD,
    Permission.PAYMENT_REVERSE,
    Permission.EXPENSE_VIEW,
    Permission.EXPENSE_MANAGE,
    Permission.FINANCE_VIEW,
    Permission.REMINDER_SEND,
    Permission.FEEDBACK_VIEW,
    Permission.COMPLAINT_VIEW,
    Permission.COMPLAINT_MANAGE,
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
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_REVERSE,
    Permission.PAUSE_VIEW,
    Permission.PAUSE_MANAGE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_RECORD,
    Permission.PAYMENT_REVERSE,
    Permission.EXPENSE_VIEW,
    Permission.EXPENSE_MANAGE,
    Permission.FINANCE_VIEW,
    Permission.REMINDER_SEND,
    Permission.FEEDBACK_VIEW,
    Permission.COMPLAINT_VIEW,
    Permission.COMPLAINT_MANAGE,
  ],
  MESS_STAFF: [
    Permission.MESS_VIEW,
    Permission.STUDENT_VIEW,
    Permission.MEAL_PLAN_VIEW,
    Permission.SUBSCRIPTION_VIEW,
    Permission.MENU_VIEW,
    Permission.ATTENDANCE_VIEW,
    Permission.ATTENDANCE_MARK,
    Permission.PAUSE_VIEW,
    Permission.PAYMENT_VIEW,
    Permission.COMPLAINT_VIEW,
  ],
  STUDENT: [Permission.STUDENT_SELF],
};

export function hasRole(role: Role | null | undefined, allowed: readonly Role[]): boolean {
  return !!role && allowed.includes(role);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].includes(permission);
}
