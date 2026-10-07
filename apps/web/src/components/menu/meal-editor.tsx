'use client';

import { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { MEAL_LABELS, MENU_LIMITS, type MealKey, type MenuMeal } from '@mess/shared';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

interface MealEditorProps {
  mealKey: MealKey;
  meal: MenuMeal;
  onChange?: (meal: MenuMeal) => void;
  readOnly?: boolean;
}

/** One meal: serving toggle, inline item list (Enter adds the next item) and an optional note. */
export function MealEditor({ mealKey, meal, onChange, readOnly }: MealEditorProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const label = MEAL_LABELS[mealKey];
  const update = (patch: Partial<MenuMeal>) => onChange?.({ ...meal, ...patch });
  const full = meal.items.length >= MENU_LIMITS.itemsPerMeal;

  const insertAfter = (index: number) => {
    if (full) return;
    const items = [...meal.items];
    items.splice(index + 1, 0, '');
    update({ items });
    requestAnimationFrame(() => inputs.current[index + 1]?.focus());
  };
  const remove = (index: number) => {
    update({ items: meal.items.filter((_, i) => i !== index) });
    requestAnimationFrame(() => inputs.current[Math.max(0, index - 1)]?.focus());
  };

  if (readOnly) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{label}</h2>
        {!meal.available ? (
          <p className="font-medium text-ink-muted">{label} unavailable</p>
        ) : meal.items.length ? (
          <ul className="list-disc pl-5">{meal.items.map((item) => <li key={item}>{item}</li>)}</ul>
        ) : (
          <p className="text-ink-muted">No items added</p>
        )}
        {meal.note && <p className="text-sm text-ink-muted">{meal.note}</p>}
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col gap-3', !meal.available && 'bg-canvas')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{label}</h2>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <span className={meal.available ? 'text-success' : 'text-ink-muted'}>{meal.available ? 'Serving' : 'Not serving'}</span>
          <input
            type="checkbox"
            role="switch"
            aria-label={`Serve ${label.toLowerCase()}`}
            checked={meal.available}
            onChange={(e) => update({ available: e.target.checked })}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500"
          />
        </label>
      </div>

      {meal.available ? (
        <>
          <ul className="flex flex-col gap-2">
            {meal.items.map((item, i) => (
              <li key={i} className="flex gap-2">
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={item}
                  maxLength={MENU_LIMITS.itemLength}
                  placeholder="Dish name"
                  aria-label={`${label} item ${i + 1}`}
                  onChange={(e) => update({ items: meal.items.map((v, j) => (j === i ? e.target.value : v)) })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      insertAfter(i);
                    } else if (e.key === 'Backspace' && item === '' && meal.items.length > 1) {
                      e.preventDefault();
                      remove(i);
                    }
                  }}
                  className="h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${item || 'item'}`}
                  className="grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-danger-soft hover:text-danger"
                >
                  <X className="size-5" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={full}
            onClick={() => insertAfter(meal.items.length - 1)}
            className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-control px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:text-ink-muted"
          >
            <Plus className="size-4" aria-hidden /> {full ? `Max ${MENU_LIMITS.itemsPerMeal} items` : 'Add item'}
          </button>
        </>
      ) : (
        <p className="text-sm text-ink-muted">Students will see “{label} unavailable”.</p>
      )}

      <input
        value={meal.note ?? ''}
        maxLength={MENU_LIMITS.mealNoteLength}
        placeholder={meal.available ? 'Note (optional), e.g. served 7:30–9 PM' : 'Reason (optional), e.g. holiday'}
        aria-label={`${label} note`}
        onChange={(e) => update({ note: e.target.value })}
        className="h-10 rounded-control border border-dashed border-border bg-transparent px-3 text-sm focus:border-brand-500 focus:outline-none"
      />
    </Card>
  );
}
