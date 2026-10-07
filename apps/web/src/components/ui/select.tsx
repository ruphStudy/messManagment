import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClass, describedBy, Field } from './field';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, options, placeholder, error, hint, required, className, ...props },
  ref,
) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          name={id}
          required={required}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass(error), 'appearance-none pr-10')}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
      </div>
    </Field>
  );
});
