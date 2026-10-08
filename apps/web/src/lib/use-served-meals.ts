'use client';

import { useEffect, useState } from 'react';
import { MEAL_KEYS, type MealType, type MessProfile } from '@mess/shared';
import { api } from './api';

/** Meals this mess serves (from mess settings). Falls back to all meals if settings can't be loaded. */
export function useServedMeals(): MealType[] | null {
  const [meals, setMeals] = useState<MealType[] | null>(null);
  useEffect(() => {
    api<MessProfile>('/mess')
      .then((m) => {
        const served = MEAL_KEYS.filter((k) => m[`${k}Available`]);
        setMeals(served.length ? served : [...MEAL_KEYS]);
      })
      .catch(() => setMeals([...MEAL_KEYS]));
  }, []);
  return meals;
}

/** Breakfast before 11, lunch before 4 pm, dinner after — limited to meals the mess serves. */
export function defaultMeal(served: MealType[]): MealType {
  const hour = new Date().getHours();
  const preferred: MealType = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner';
  if (served.includes(preferred)) return preferred;
  const order = MEAL_KEYS.indexOf(preferred);
  return served.find((m) => MEAL_KEYS.indexOf(m) > order) ?? served[served.length - 1];
}
