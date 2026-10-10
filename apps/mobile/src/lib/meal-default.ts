import { DEFAULT_SERVING_TIMES, istClockTime, MEAL_KEYS, mealAtTime, servingWindow, type MealServingTimes, type MealType, type MessProfile } from '@mess/shared';
import { useApi } from './team';

/** Meals this mess serves + serving windows (mess settings), for the scanner/manual default meal. */
export function useServedMeals(): { meals: MealType[]; times: MealServingTimes } | null {
  const { data, error } = useApi<MessProfile>('/mess');
  if (error) return { meals: [...MEAL_KEYS], times: DEFAULT_SERVING_TIMES };
  if (!data) return null;
  const meals = MEAL_KEYS.filter((k) => data[`${k}Available`]);
  return { meals: meals.length ? meals : [...MEAL_KEYS], times: data };
}

/** Same rule as the web scanner: the meal being served now, else the next one; after the last, the last one. */
export function defaultMeal(meals: MealType[], times: MealServingTimes): MealType {
  const at = mealAtTime(times, meals, istClockTime());
  if (at) return at.meal;
  return [...meals].sort((a, b) => servingWindow(times, a).start.localeCompare(servingWindow(times, b).start)).at(-1) ?? meals[0];
}
