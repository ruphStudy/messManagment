import { Coffee, Moon, Sun } from 'lucide-react';
import { MEAL_LABELS, type MealType } from '@mess/shared';
import { cn } from '@/lib/cn';

const ICONS = { breakfast: Coffee, lunch: Sun, dinner: Moon } as const;

/** Big segmented meal selector for fast, error-free switching on phones. */
export function MealPicker({ meals, value, onChange }: { meals: MealType[]; value: MealType; onChange: (meal: MealType) => void }) {
  return (
    <div role="radiogroup" aria-label="Meal" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${meals.length}, minmax(0, 1fr))` }}>
      {meals.map((meal) => {
        const Icon = ICONS[meal];
        const active = meal === value;
        return (
          <button
            key={meal}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(meal)}
            className={cn(
              'flex min-h-14 items-center justify-center gap-2 rounded-control border-2 text-base font-semibold transition-colors',
              active ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-surface hover:border-brand-200',
            )}
          >
            <Icon className="size-5" aria-hidden /> {MEAL_LABELS[meal]}
          </button>
        );
      })}
    </div>
  );
}
