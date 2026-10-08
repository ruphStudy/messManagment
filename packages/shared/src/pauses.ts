import type { ErrorCode, PaginationQuery } from './api';
import type { MealType } from './attendance';
import { BUSINESS_TIME_ZONE } from './meal-plans';

export const PauseStatus = { ACTIVE: 'ACTIVE', CANCELLED: 'CANCELLED' } as const;
export type PauseStatus = (typeof PauseStatus)[keyof typeof PauseStatus];

/** Who created the pause: the student in the app, or the mess team on their behalf. */
export const PauseSource = { STUDENT: 'STUDENT', MESS: 'MESS' } as const;
export type PauseSource = (typeof PauseSource)[keyof typeof PauseSource];

/** Max days one pause request may cover. */
export const PAUSE_MAX_DAYS = 31;
export const PAUSE_REASON_MAX = 120;
export const PAUSE_REASON_PRESETS = ['Going home', 'Holiday', 'Exams', 'Personal'] as const;

export const DEFAULT_PAUSE_CUTOFFS: Record<MealType, string> = { breakfast: '06:00', lunch: '09:00', dinner: '16:00' };

export interface CreatePauseRequest {
  fromDate: string;
  /** Same as fromDate for a single day. */
  toDate: string;
  mealTypes: MealType[];
  reason?: string;
}

export interface PauseOutcomeItem {
  date: string;
  mealType: MealType;
  reason: ErrorCode;
  message: string;
}

/** Every requested date × meal ends up in exactly one list. */
export interface CreatePauseResult {
  created: { id: string; date: string; mealType: MealType }[];
  /** Nothing to do: already paused, or already eaten. */
  skipped: PauseOutcomeItem[];
  /** Not allowed: cut-off passed, no plan that day, meal not in plan… */
  failed: PauseOutcomeItem[];
}

export interface PauseRecord {
  id: string;
  date: string;
  mealType: MealType;
  status: PauseStatus;
  source: PauseSource;
  reason: string | null;
  student: { id: string; firstName: string; lastName: string | null; mobile: string };
  createdBy: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  /** Active and not in the past. */
  canCancel: boolean;
}

export interface PauseListQuery extends PaginationQuery {
  from?: string;
  to?: string;
  mealType?: MealType;
  status?: PauseStatus;
  studentId?: string;
  search?: string;
}

export interface PauseCalendarDay {
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
}

export const StudentPauseView = { UPCOMING: 'upcoming', PAST: 'past', CANCELLED: 'cancelled' } as const;
export type StudentPauseView = (typeof StudentPauseView)[keyof typeof StudentPauseView];

export type StudentPauseItem = Omit<PauseRecord, 'student' | 'createdBy' | 'cancelledBy'>;

/** Today's state of one meal for the student. */
export type TodayMealState = 'AVAILABLE' | 'PAUSED' | 'SERVED' | 'NOT_INCLUDED';

export type StudentPauseSettings =
  | { linked: false }
  | {
      linked: true;
      messName: string;
      today: string;
      /** Business time now, HH:mm:ss (Asia/Kolkata). */
      nowTime: string;
      cutoffs: Record<MealType, string>;
      servedMeals: Record<MealType, boolean>;
      studentActive: boolean;
      /** Non-cancelled subscriptions covering today or later — lets the app grey out meals per date. */
      plans: { startDate: string; endDate: string; meals: Record<MealType, boolean> }[];
      todayMeals: Record<MealType, TodayMealState>;
    };

export interface MealCount {
  /** Students whose plan covers this meal on the date. */
  entitled: number;
  paused: number;
  /** entitled − paused: plan the kitchen on this. */
  expected: number;
  served: number;
  /** expected − served (never below 0). */
  remaining: number;
}

export interface ExpectedMeals {
  date: string;
  meals: Record<MealType, MealCount>;
}

// ── Time rules (Asia/Kolkata) ──

/** Current business time as HH:mm:ss. */
export function businessNowTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/**
 * The single cut-off rule. Past dates: always passed. Future dates: never passed.
 * Today: passed AT the cut-off minute and after (09:00 cut-off → 08:59:59 allowed, 09:00:00 blocked).
 */
export function isPauseCutoffPassed(date: string, cutoff: string, today: string, nowTime: string): boolean {
  if (date < today) return true;
  if (date > today) return false;
  return nowTime >= `${cutoff}:00`;
}

/** "09:00" → "9:00 AM" */
export function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const MEAL_NAMES: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/** Student/owner-facing explanation for a meal that could not be paused. */
export function pauseOutcomeMessage(reason: ErrorCode | string, mealType: MealType): string {
  const meal = MEAL_NAMES[mealType];
  switch (reason) {
    case 'NO_ACTIVE_SUBSCRIPTION':
      return 'No meal plan on this day.';
    case 'MEAL_NOT_INCLUDED':
      return `${meal} is not in the plan on this day.`;
    case 'ATTENDANCE_ALREADY_SERVED':
      return `${meal} was already used on this day.`;
    case 'PAUSE_ALREADY_EXISTS':
      return `${meal} is already paused.`;
    case 'PAUSE_CUTOFF_PASSED':
      return `${meal} can no longer be paused for today.`;
    default:
      return `${meal} could not be paused.`;
  }
}
