import { emptyMenuMeal, MEAL_KEYS, normalizeMenuItems, type DailyMenuInput, type MealKey, type MenuMeal } from '@mess/shared';

const dayFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDayFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Thursday, 8 October 2026" */
export const longDate = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));
/** "Thu, 8 Oct" */
export const shortDate = (date: string) => shortDayFormat.format(new Date(`${date}T00:00:00Z`));

/** A new day's menu: meals the mess doesn't normally serve start as unavailable. */
export function emptyMenu(served?: Partial<Record<MealKey, boolean>>): DailyMenuInput {
  const meal = (key: MealKey): MenuMeal => {
    const available = served?.[key] ?? true;
    // One blank row per served meal so the owner can start typing straight away.
    return { ...emptyMenuMeal(), available, items: available ? [''] : [] };
  };
  return { breakfast: meal('breakfast'), lunch: meal('lunch'), dinner: meal('dinner'), generalNote: null };
}

/** Normalized copy for saving and for dirty-checking (blank lines and duplicates dropped, notes trimmed). */
export function cleanMenu(menu: DailyMenuInput): DailyMenuInput {
  const clean = (m: MenuMeal): MenuMeal => ({ available: m.available, items: normalizeMenuItems(m.items), note: m.note?.trim() || null });
  return { breakfast: clean(menu.breakfast), lunch: clean(menu.lunch), dinner: clean(menu.dinner), generalNote: menu.generalNote?.trim() || null };
}

export function pickMenuInput(menu: DailyMenuInput): DailyMenuInput {
  return Object.fromEntries([...MEAL_KEYS.map((k) => [k, menu[k]]), ['generalNote', menu.generalNote]]) as unknown as DailyMenuInput;
}

/** One-line summary for weekly cards: "Chapati, Dal, Rice" / "Unavailable" / "—". */
export function mealSummary(meal: MenuMeal) {
  if (!meal.available) return 'Unavailable';
  return meal.items.length ? meal.items.join(', ') : '—';
}
