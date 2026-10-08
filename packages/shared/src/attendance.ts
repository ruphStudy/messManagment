import type { ErrorCode, PaginationQuery } from './api';
import type { MealKey } from './menus';

/** Meal types reuse the menu meal keys: 'breakfast' | 'lunch' | 'dinner'. */
export type MealType = MealKey;

export const AttendanceSource = { QR: 'QR', MANUAL: 'MANUAL' } as const;
export type AttendanceSource = (typeof AttendanceSource)[keyof typeof AttendanceSource];

export const AttendanceStatus = { SERVED: 'SERVED', REVERSED: 'REVERSED' } as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

/** Student meal QR lifetime. The app refreshes it before it expires. */
export const MEAL_QR_TTL_SECONDS = 60;
export const MEAL_QR_REFRESH_BEFORE_SECONDS = 10;
export const ATTENDANCE_NOTE_MAX = 200;

export interface AttendanceStudent {
  id: string;
  firstName: string;
  lastName: string | null;
  mobile: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  mealType: MealType;
  source: AttendanceSource;
  status: AttendanceStatus;
  /** When the meal was marked served. */
  servedAt: string;
  student: AttendanceStudent;
  planName: string;
  /** Whether this attendance used one meal credit (limited plans only). */
  creditDeducted: boolean;
  /** Current balance of the subscription used; null for unlimited plans. */
  remainingMealCredits: number | null;
  totalMealCredits: number | null;
  servedBy: string | null;
  note: string | null;
  reversedAt: string | null;
  reversedBy: string | null;
  reversalReason: string | null;
}

export interface AttendanceListQuery extends PaginationQuery {
  date?: string;
  mealType?: MealType;
  status?: AttendanceStatus;
  search?: string;
}

/** Served (not reversed) meals for one date. */
export interface AttendanceSummary {
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
}

export interface ScanRequest {
  qrToken: string;
  mealType: MealType;
}

export interface ManualAttendanceRequest {
  studentId: string;
  mealType: MealType;
  note?: string;
}

export interface ReverseAttendanceRequest {
  reason?: string;
}

/**
 * Outcome of a scan / manual mark. Rejections are normal results (HTTP 200) so the scanner can show
 * who was scanned and why; auth/validation problems still use HTTP errors.
 */
export type ServeResult =
  | { outcome: 'SERVED'; attendance: AttendanceRecord }
  | {
      outcome: 'REJECTED';
      reason: ErrorCode;
      message: string;
      mealType: MealType;
      /** Present once the student is identified within your mess. */
      student: AttendanceStudent | null;
      planName: string | null;
    };

/** Student's own meal QR. Only READY carries a token. */
export type MealQrResponse =
  | { state: 'NOT_LINKED' }
  | { state: 'INACTIVE'; messName: string }
  | { state: 'NO_PLAN'; messName: string; studentName: string }
  | {
      state: 'READY';
      token: string;
      /** ISO time the token stops working. */
      expiresAt: string;
      expiresIn: number;
      studentName: string;
      messName: string;
      planName: string;
      meals: Record<MealType, boolean>;
      /** Meals already served today. */
      servedToday: MealType[];
    };

export interface StudentAttendanceItem {
  id: string;
  date: string;
  mealType: MealType;
  status: AttendanceStatus;
  servedAt: string;
  planName: string;
}

const MEAL_NAMES: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/** Short, staff-facing explanation for a rejected serve (used by the API and the scanner UI). */
export function serveRejectionMessage(reason: ErrorCode | string, mealType: MealType): string {
  const meal = MEAL_NAMES[mealType];
  switch (reason) {
    case 'QR_EXPIRED':
      return 'QR expired. Ask the student to refresh it.';
    case 'QR_INVALID':
      return 'Invalid QR code.';
    case 'STUDENT_NOT_FOUND':
      return 'Student not found in your mess.';
    case 'STUDENT_NOT_ACTIVE':
      return 'Student is not active.';
    case 'NO_ACTIVE_SUBSCRIPTION':
      return 'No active meal plan.';
    case 'MEAL_NOT_INCLUDED':
      return `${meal} is not included in this plan.`;
    case 'NO_MEAL_CREDITS':
      return 'No meals remaining.';
    case 'ALREADY_SERVED':
      return `${meal} already served today.`;
    default:
      return 'Unable to serve this meal.';
  }
}
