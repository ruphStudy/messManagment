import { addDays } from './meal-plans';

export const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealKey = (typeof MEAL_KEYS)[number];

export const MEAL_LABELS: Record<MealKey, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export const MENU_LIMITS = {
  itemsPerMeal: 15,
  itemLength: 60,
  mealNoteLength: 200,
  generalNoteLength: 300,
  /** Max days a single range request may cover. */
  rangeDays: 31,
} as const;

export interface MenuMeal {
  /** false = not served that day (holiday, kitchen closed…). */
  available: boolean;
  items: string[];
  note: string | null;
}

export interface DailyMenuInput {
  breakfast: MenuMeal;
  lunch: MenuMeal;
  dinner: MenuMeal;
  generalNote: string | null;
}

/** Owner/staff view, including drafts. */
export interface DailyMenu extends DailyMenuInput {
  id: string;
  date: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

/** One calendar day; `menu` is null when nothing has been created for it. */
export interface MenuDay {
  date: string;
  menu: DailyMenu | null;
}

export interface CopyMenuRequest {
  sourceDate: string;
  /** Must be true to overwrite an existing menu on the destination date. */
  replace?: boolean;
}

export interface CopyWeekRequest {
  /** Any date in the destination week; the previous week (Mon–Sun) is copied into it. */
  weekStart: string;
  /** Overwrite destination days that already have a menu (default: skip them). */
  replace?: boolean;
}

export interface CopyWeekResult {
  copied: string[];
  skipped: { date: string; reason: string }[];
  failed: { date: string; reason: string }[];
}

/** Student view: only published menus, no draft/publish metadata. */
export type PublishedMenu = DailyMenuInput & { updatedAt: string };

export interface StudentMenuDay {
  date: string;
  /** null = not published for this day. */
  menu: PublishedMenu | null;
}

export type StudentMenuResponse =
  | { linked: false }
  | {
      linked: true;
      messName: string;
      /** Meals the mess normally serves (from mess settings). */
      servedMeals: Record<MealKey, boolean>;
      days: StudentMenuDay[];
    };

export const StudentMenuRange = { TODAY: 'today', TOMORROW: 'tomorrow', WEEK: 'week' } as const;
export type StudentMenuRange = (typeof StudentMenuRange)[keyof typeof StudentMenuRange];

/** Trims items, drops blanks and case-insensitive duplicates (keeps first spelling). */
export function normalizeMenuItems(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    const item = raw.replace(/\s+/g, ' ').trim();
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function emptyMenuMeal(): MenuMeal {
  return { available: true, items: [], note: null };
}

/** True when at least one available meal has an item — used to warn before publishing an empty menu. */
export function menuHasItems(menu: DailyMenuInput): boolean {
  return MEAL_KEYS.some((k) => menu[k].available && menu[k].items.length > 0);
}

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function startOfWeek(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** The 7 dates starting at `from`. */
export function weekDates(from: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(from, i));
}
