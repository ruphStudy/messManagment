import { CalendarDays, Utensils, Hash } from 'lucide-react';
import { durationLabel, mealsLabel, type MealEntitlement, type PlanDurationType } from '@mess/shared';

/** Meals · duration · meal-count line used on plan cards and pickers. */
export function PlanFacts({ plan }: { plan: MealEntitlement & { durationType: PlanDurationType; durationValue: number; mealCredits: number | null } }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
      <li className="inline-flex items-center gap-1.5"><Utensils className="size-4" aria-hidden /> {mealsLabel(plan)}</li>
      <li className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden /> {durationLabel(plan.durationType, plan.durationValue)}</li>
      <li className="inline-flex items-center gap-1.5"><Hash className="size-4" aria-hidden /> {plan.mealCredits ? `${plan.mealCredits} meals` : 'Unlimited meals'}</li>
    </ul>
  );
}
