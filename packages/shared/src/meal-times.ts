import { MEAL_KEYS, type MealKey } from './menus';

/** Per-meal serving windows, HH:mm in the mess's time zone (Asia/Kolkata). */
export interface MealServingTimes {
  breakfastStart: string;
  breakfastEnd: string;
  lunchStart: string;
  lunchEnd: string;
  dinnerStart: string;
  dinnerEnd: string;
}

export const DEFAULT_SERVING_TIMES: MealServingTimes = {
  breakfastStart: '07:30',
  breakfastEnd: '09:30',
  lunchStart: '12:00',
  lunchEnd: '14:30',
  dinnerStart: '19:30',
  dinnerEnd: '21:30',
};

export function servingWindow(times: MealServingTimes, meal: MealKey): { start: string; end: string } {
  return { start: times[`${meal}Start`], end: times[`${meal}End`] };
}

/** Start/end pairs that are out of order, as field errors (`lunchEnd: [...]`). */
export function servingTimeErrors(times: MealServingTimes): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const meal of MEAL_KEYS) {
    const { start, end } = servingWindow(times, meal);
    if (end <= start) errors[`${meal}End`] = ['End time must be after start time'];
  }
  return errors;
}

export type MealTimeState = 'CURRENT' | 'NEXT';

/**
 * The single "which meal now?" rule (scanner default, student Home):
 * the served meal whose window contains `now` (CURRENT), else the next served meal later today (NEXT),
 * else null (all of today's meals are over). `now` is HH:mm or HH:mm:ss business time.
 */
export function mealAtTime(times: MealServingTimes, served: readonly MealKey[], now: string): { meal: MealKey; state: MealTimeState } | null {
  const hhmm = now.slice(0, 5);
  const meals = MEAL_KEYS.filter((m) => served.includes(m)).sort((a, b) => servingWindow(times, a).start.localeCompare(servingWindow(times, b).start));
  const current = meals.find((m) => {
    const w = servingWindow(times, m);
    return hhmm >= w.start && hhmm < w.end;
  });
  if (current) return { meal: current, state: 'CURRENT' };
  const next = meals.find((m) => servingWindow(times, m).start > hhmm);
  return next ? { meal: next, state: 'NEXT' } : null;
}

/** Meals still to come today (current one first), in serving order. */
export function remainingMeals(times: MealServingTimes, served: readonly MealKey[], now: string): MealKey[] {
  const at = mealAtTime(times, served, now);
  if (!at) return [];
  const startOf = (m: MealKey) => servingWindow(times, m).start;
  return MEAL_KEYS.filter((m) => served.includes(m) && startOf(m) >= startOf(at.meal)).sort((a, b) => startOf(a).localeCompare(startOf(b)));
}

/** "13:05" → "1:05 PM" */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** IST is a fixed UTC+05:30 (no DST). */
const IST_OFFSET_MS = 330 * 60_000;

/** Current Indian time as HH:mm using plain arithmetic (no Intl time-zone support needed, e.g. on mobile). */
export function istClockTime(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

/** Today's Indian date (YYYY-MM-DD) without Intl time-zone support (mobile-safe). */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
