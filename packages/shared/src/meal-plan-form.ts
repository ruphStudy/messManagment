import { MEAL_PLAN_LIMITS, PlanDurationType, type MealPlan, type MealPlanInput } from './meal-plans';

/** Meal-plan form rules shared by web and mobile (mirror the API DTO; the API re-checks). */

export interface MealPlanFormValues extends Record<string, unknown> {
  name: string;
  description: string;
  price: string;
  breakfastIncluded: boolean;
  lunchIncluded: boolean;
  dinnerIncluded: boolean;
  durationType: PlanDurationType;
  durationValue: string;
  limited: boolean;
  mealCredits: string;
}

/** One-tap starting points for the most common plans. */
export const PLAN_PRESETS: { label: string; values: Partial<MealPlanFormValues> }[] = [
  { label: 'Lunch only', values: { name: 'Lunch Only', lunchIncluded: true, dinnerIncluded: false, breakfastIncluded: false, limited: false } },
  { label: 'Dinner only', values: { name: 'Dinner Only', lunchIncluded: false, dinnerIncluded: true, breakfastIncluded: false, limited: false } },
  { label: 'Lunch + Dinner', values: { name: 'Lunch + Dinner', lunchIncluded: true, dinnerIncluded: true, breakfastIncluded: false, limited: false } },
  { label: '30 meals pack', values: { name: '30 Meals Pack', lunchIncluded: true, dinnerIncluded: true, breakfastIncluded: false, limited: true, mealCredits: '30' } },
];

export function emptyMealPlanForm(): MealPlanFormValues {
  return {
    name: '',
    description: '',
    price: '',
    breakfastIncluded: false,
    lunchIncluded: true,
    dinnerIncluded: true,
    durationType: PlanDurationType.MONTHS,
    durationValue: '1',
    limited: false,
    mealCredits: '',
  };
}

export function mealPlanToForm(plan: MealPlan): MealPlanFormValues {
  return {
    name: plan.name,
    description: plan.description ?? '',
    price: String(plan.price),
    breakfastIncluded: plan.breakfastIncluded,
    lunchIncluded: plan.lunchIncluded,
    dinnerIncluded: plan.dinnerIncluded,
    durationType: plan.durationType,
    durationValue: String(plan.durationValue),
    limited: plan.mealCredits !== null,
    mealCredits: plan.mealCredits === null ? '' : String(plan.mealCredits),
  };
}

const isWhole = (v: string) => /^\d+$/.test(v.trim());

export function validateMealPlan(v: MealPlanFormValues): Record<string, string | undefined> {
  const maxDuration = v.durationType === PlanDurationType.DAYS ? MEAL_PLAN_LIMITS.daysMax : MEAL_PLAN_LIMITS.monthsMax;
  const duration = Number(v.durationValue);
  const price = v.price.trim();
  return {
    name: !v.name.trim() ? 'Plan name is required' : v.name.trim().length > MEAL_PLAN_LIMITS.nameMax ? 'Name is too long' : undefined,
    description: v.description.length > MEAL_PLAN_LIMITS.descriptionMax ? 'Description is too long' : undefined,
    price: !/^\d+(\.\d{1,2})?$/.test(price)
      ? 'Enter a price like 3000 or 2999.50'
      : Number(price) > MEAL_PLAN_LIMITS.priceMax
        ? 'Price is too high'
        : undefined,
    meals: v.breakfastIncluded || v.lunchIncluded || v.dinnerIncluded ? undefined : 'Select at least one meal',
    durationValue: !isWhole(v.durationValue) || duration < 1 || duration > maxDuration ? `Enter 1 to ${maxDuration}` : undefined,
    mealCredits:
      v.limited && (!isWhole(v.mealCredits) || Number(v.mealCredits) < 1 || Number(v.mealCredits) > MEAL_PLAN_LIMITS.mealCreditsMax)
        ? `Enter 1 to ${MEAL_PLAN_LIMITS.mealCreditsMax} meals`
        : undefined,
  };
}

export function toMealPlanInput(v: MealPlanFormValues): MealPlanInput {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    price: Number(v.price),
    breakfastIncluded: v.breakfastIncluded,
    lunchIncluded: v.lunchIncluded,
    dinnerIncluded: v.dinnerIncluded,
    durationType: v.durationType,
    durationValue: Number(v.durationValue),
    mealCredits: v.limited ? Number(v.mealCredits) : null,
  };
}
