import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  id: string;
  label: ReactNode;
  description?: string;
}

export function Checkbox({ id, label, description, className, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cn('flex min-h-11 cursor-pointer items-start gap-3 py-1', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-brand-600" {...props} />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink">{label}</span>
        {description && <span className="text-sm text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

interface RadioGroupProps<T extends string> {
  name: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
  error?: string;
}

/** Card-style radio buttons: large touch targets for non-technical users. */
export function RadioGroup<T extends string>({ name, label, value, options, onChange, error }: RadioGroupProps<T>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 transition-colors',
                checked ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface hover:bg-canvas',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="mt-0.5 size-5 shrink-0 accent-brand-600"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{option.label}</span>
                {option.description && <span className="text-sm text-ink-muted">{option.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
