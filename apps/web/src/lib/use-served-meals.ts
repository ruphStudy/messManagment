'use client';

import { useEffect, useState } from 'react';
import {
  businessNowTime,
  DEFAULT_SERVING_TIMES,
  MEAL_KEYS,
  mealAtTime,
  servingWindow,
  type MealServingTimes,
  type MealType,
  type MessProfile,
} from '@mess/shared';
import { api } from './api';

export interface ServedMeals {
  meals: MealType[];
  times: MealServingTimes;
}

/** Meals this mess serves and their serving windows (from mess settings). Falls back to all meals / default times. */
export function useServedMeals(): ServedMeals | null {
  const [served, setServed] = useState<ServedMeals | null>(null);
  useEffect(() => {
    api<MessProfile>('/mess')
      .then((m) => {
        const meals = MEAL_KEYS.filter((k) => m[`${k}Available`]);
        setServed({ meals: meals.length ? meals : [...MEAL_KEYS], times: m });
      })
      .catch(() => setServed({ meals: [...MEAL_KEYS], times: DEFAULT_SERVING_TIMES }));
  }, []);
  return served;
}

/**
 * Default meal for scanning: the meal being served now, else the next one today (configured serving times,
 * Indian time); after the last meal, the last one (late entries). Staff can always switch manually.
 */
export function defaultMeal(meals: MealType[], times: MealServingTimes): MealType {
  const at = mealAtTime(times, meals, businessNowTime());
  if (at) return at.meal;
  return [...meals].sort((a, b) => servingWindow(times, a).start.localeCompare(servingWindow(times, b).start)).at(-1) ?? meals[0];
}
