import type { PaginationQuery } from './api';
import type { StudentStatus } from './students';

export const MealPlanStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export type MealPlanStatus = (typeof MealPlanStatus)[keyof typeof MealPlanStatus];

export const PlanDurationType = { DAYS: 'DAYS', MONTHS: 'MONTHS' } as const;
export type PlanDurationType = (typeof PlanDurationType)[keyof typeof PlanDurationType];

/** UPCOMING / ACTIVE / EXPIRED are derived from dates; only CANCELLED is stored (as cancelledAt). */
export const SubscriptionStatus = {
  UPCOMING: 'UPCOMING',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  UPCOMING: 'Upcoming',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const SubscriptionKind = { NEW: 'NEW', RENEWAL: 'RENEWAL', PLAN_CHANGE: 'PLAN_CHANGE' } as const;
export type SubscriptionKind = (typeof SubscriptionKind)[keyof typeof SubscriptionKind];

export const SUBSCRIPTION_KIND_LABELS: Record<SubscriptionKind, string> = {
  NEW: 'New',
  RENEWAL: 'Renewal',
  PLAN_CHANGE: 'Plan change',
};

export const PlanChangeMode = { AFTER_CURRENT: 'AFTER_CURRENT', IMMEDIATE: 'IMMEDIATE' } as const;
export type PlanChangeMode = (typeof PlanChangeMode)[keyof typeof PlanChangeMode];

export const EXPIRING_SOON_DAYS = 7;
/** Mess calendar days are Indian dates regardless of server or device timezone. */
export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

export const MEAL_PLAN_LIMITS = {
  nameMax: 80,
  descriptionMax: 300,
  priceMax: 1_000_000,
  daysMax: 366,
  monthsMax: 12,
  mealCreditsMax: 1000,
} as const;

export interface MealEntitlement {
  breakfastIncluded: boolean;
  lunchIncluded: boolean;
  dinnerIncluded: boolean;
}

export interface MealPlanInput extends MealEntitlement {
  name: string;
  description: string | null;
  /** Rupees, up to 2 decimals. */
  price: number;
  durationType: PlanDurationType;
  durationValue: number;
  /** Number of meals for a limited package; null = unlimited within validity. */
  mealCredits: number | null;
}

export interface MealPlan extends MealPlanInput {
  id: string;
  status: MealPlanStatus;
  /** Active + upcoming subscriptions using this plan. */
  currentSubscriptionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanListQuery {
  status?: MealPlanStatus;
  search?: string;
}

/** Plan details copied onto the subscription when it was created; later plan edits do not change it. */
export interface SubscriptionPlanSnapshot extends MealEntitlement {
  name: string;
  price: number;
}

export interface SubscriptionSummary {
  id: string;
  /** Plan this was created from; null only if that plan was removed. */
  mealPlanId: string | null;
  status: SubscriptionStatus;
  kind: SubscriptionKind;
  startDate: string;
  endDate: string;
  plan: SubscriptionPlanSnapshot;
  /** null for unlimited plans */
  totalMealCredits: number | null;
  remainingMealCredits: number | null;
  /** Days left including today, for active subscriptions only. */
  daysRemaining: number | null;
  cancelledAt: string | null;
  /** Fee / paid / due for this subscription. */
  payment: import('./payments').SubscriptionPaymentSummary;
}

export interface SubscriptionStudent {
  id: string;
  firstName: string;
  lastName: string | null;
  mobile: string;
}

export interface SubscriptionListItem extends SubscriptionSummary {
  student: SubscriptionStudent;
}

export interface SubscriptionDetail extends SubscriptionListItem {
  student: SubscriptionStudent & { status: StudentStatus };
  /** The reusable plan this was created from (may have changed since — see `plan` for what was assigned). */
  mealPlan: { id: string; name: string; status: MealPlanStatus } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionListQuery extends PaginationQuery {
  status?: SubscriptionStatus;
  search?: string;
  mealPlanId?: string;
  studentId?: string;
  /** Active subscriptions ending within EXPIRING_SOON_DAYS with no renewal scheduled. */
  expiringSoon?: boolean;
}

export interface AssignSubscriptionRequest {
  mealPlanId: string;
  startDate: string;
  /** Optional override; defaults to the plan duration. */
  endDate?: string;
}

export interface RenewSubscriptionRequest {
  /** Defaults to the same plan. */
  mealPlanId?: string;
  /** Defaults to the day after the current subscription ends (or today if it already ended). */
  startDate?: string;
  endDate?: string;
}

export interface ChangePlanRequest {
  mealPlanId: string;
  mode: PlanChangeMode;
}

export type MySubscriptionResponse =
  | { linked: false }
  | { linked: true; messName: string; current: SubscriptionSummary | null; upcoming: SubscriptionSummary | null };

// ── Date helpers on YYYY-MM-DD strings (UTC arithmetic, no timezone drift) ──

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);
const fromUtc = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/**
 * Inclusive end date: 30 days from 1 Sep → 30 Sep; 1 month from 15 Jan → 14 Feb.
 * If the same day does not exist in the target month, the plan runs to that month's last day (31 Jan + 1 month → 28 Feb).
 */
export function calculateEndDate(startDate: string, durationType: PlanDurationType, durationValue: number): string {
  if (durationType === PlanDurationType.DAYS) return addDays(startDate, durationValue - 1);
  const start = toUtc(startDate);
  const day = start.getUTCDate();
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + durationValue, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  if (day > lastDay) return fromUtc(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), lastDay)));
  return addDays(fromUtc(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day))), -1);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** Today's date in the mess timezone. */
export function businessToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The single rule for subscription status. */
export function subscriptionStatus(
  sub: { startDate: string; endDate: string; cancelledAt: string | Date | null },
  today: string,
): SubscriptionStatus {
  if (sub.cancelledAt) return SubscriptionStatus.CANCELLED;
  if (sub.startDate > today) return SubscriptionStatus.UPCOMING;
  if (sub.endDate < today) return SubscriptionStatus.EXPIRED;
  return SubscriptionStatus.ACTIVE;
}

export function mealsLabel({ breakfastIncluded, lunchIncluded, dinnerIncluded }: MealEntitlement): string {
  const meals = [breakfastIncluded && 'Breakfast', lunchIncluded && 'Lunch', dinnerIncluded && 'Dinner'].filter(Boolean);
  return meals.length === 3 ? 'All meals' : meals.join(' + ') || 'No meals';
}

export function durationLabel(durationType: PlanDurationType, durationValue: number): string {
  const unit = durationType === PlanDurationType.DAYS ? 'day' : 'month';
  return `${durationValue} ${unit}${durationValue === 1 ? '' : 's'}`;
}

const shortDateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "2026-10-12" → "12 Oct" (calendar date, no timezone shift). */
export function formatShortDate(date: string): string {
  return shortDateFormat.format(new Date(`${date}T00:00:00Z`));
}
