import type { PaginationQuery } from './api';

export const NotificationType = {
  PAYMENT_DUE: 'PAYMENT_DUE',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION_EXPIRING',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  MENU_CHANGED: 'MENU_CHANGED',
  MEAL_PAUSE_CREATED: 'MEAL_PAUSE_CREATED',
  MEAL_PAUSE_CANCELLED: 'MEAL_PAUSE_CANCELLED',
  MANUAL_REMINDER: 'MANUAL_REMINDER',
  /** To the student: status change or reply on their complaint. */
  COMPLAINT_UPDATED: 'COMPLAINT_UPDATED',
  /** To owner/manager: a new complaint was raised. */
  COMPLAINT_CREATED: 'COMPLAINT_CREATED',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** IN_APP is always stored; PUSH is an optional extra delivery. Future channels (WhatsApp/SMS/email) are not implemented. */
export const NotificationChannel = { IN_APP: 'IN_APP', PUSH: 'PUSH' } as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const PushStatus = { NOT_SENT: 'NOT_SENT', PENDING: 'PENDING', SENT: 'SENT', FAILED: 'FAILED' } as const;
export type PushStatus = (typeof PushStatus)[keyof typeof PushStatus];

export const PushPlatform = { IOS: 'IOS', ANDROID: 'ANDROID' } as const;
export type PushPlatform = (typeof PushPlatform)[keyof typeof PushPlatform];

export const NOTIFICATION_LIMITS = { titleMax: 80, bodyMax: 300, noteMax: 200, bulkMax: 200, pushTokenMax: 200 } as const;

/** Days before a plan ends when students get an expiry reminder (plus one on the last day). */
export const EXPIRY_REMINDER_DAYS = 3;

/** Where a tap should take the user (mapped to real routes by each app). */
export const NotificationScreen = {
  HOME: 'home',
  PAYMENTS: 'payments',
  MENU: 'menu',
  PAUSE: 'pause',
  PLANS: 'plans',
  DUES: 'dues',
  SUBSCRIPTIONS: 'subscriptions',
  /** With `complaintId`. */
  COMPLAINT: 'complaint',
} as const;
export type NotificationScreen = (typeof NotificationScreen)[keyof typeof NotificationScreen];

export interface NotificationData {
  screen?: NotificationScreen;
  [key: string]: string | number | boolean | undefined;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData | null;
  readAt: string | null;
  createdAt: string;
  /** Mess the notification is about (student apps switch to it before opening); null = account-wide. */
  messId: string | null;
}

export interface NotificationListQuery extends PaginationQuery {
  unreadOnly?: boolean;
  type?: NotificationType;
}

export interface NotificationPreferences {
  paymentDueEnabled: boolean;
  subscriptionExpiryEnabled: boolean;
  menuUpdatesEnabled: boolean;
  pauseUpdatesEnabled: boolean;
  pushEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  paymentDueEnabled: true,
  subscriptionExpiryEnabled: true,
  menuUpdatesEnabled: true,
  pauseUpdatesEnabled: true,
  pushEnabled: true,
};

/** Which preference switches a type off. Types not listed (manual reminders, system notices) always arrive in-app. */
export const PREFERENCE_FOR_TYPE: Partial<Record<NotificationType, keyof NotificationPreferences>> = {
  PAYMENT_DUE: 'paymentDueEnabled',
  SUBSCRIPTION_EXPIRING: 'subscriptionExpiryEnabled',
  SUBSCRIPTION_EXPIRED: 'subscriptionExpiryEnabled',
  MENU_CHANGED: 'menuUpdatesEnabled',
  MEAL_PAUSE_CREATED: 'pauseUpdatesEnabled',
  MEAL_PAUSE_CANCELLED: 'pauseUpdatesEnabled',
};

export interface RegisterPushDeviceRequest {
  pushToken: string;
  platform: PushPlatform;
  deviceLabel?: string;
}

export const ReminderReason = { PAYMENT: 'PAYMENT', RENEWAL: 'RENEWAL', CONTACT_MESS: 'CONTACT_MESS', GENERAL: 'GENERAL' } as const;
export type ReminderReason = (typeof ReminderReason)[keyof typeof ReminderReason];

export const REMINDER_REASON_LABELS: Record<ReminderReason, string> = {
  PAYMENT: 'Payment due',
  RENEWAL: 'Plan renewal',
  CONTACT_MESS: 'Contact the mess',
  GENERAL: 'General reminder',
};

export interface SendReminderRequest {
  reason: ReminderReason;
  /** Optional short note from the owner. */
  note?: string;
}

export interface BulkPaymentReminderRequest {
  /** Explicit students (max NOTIFICATION_LIMITS.bulkMax), or… */
  studentIds?: string[];
  /** …every student of this mess who currently owes money. */
  allWithDues?: boolean;
}

export interface ReminderOutcome {
  studentId: string;
  name: string;
  reason: string;
}

export interface ReminderResult {
  sent: { studentId: string; name: string }[];
  /** Nothing to send (no dues, not on the app, opted out, just reminded). */
  skipped: ReminderOutcome[];
  failed: ReminderOutcome[];
}

export interface ExpiryRunResult {
  date: string;
  notified: number;
  skippedDuplicates: number;
}
