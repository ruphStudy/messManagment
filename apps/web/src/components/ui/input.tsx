'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClass, describedBy, Field } from './field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Text shown inside the field before the value, e.g. "+91". */
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, hint, required, className, type = 'text', prefix, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <Field id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-ink-muted">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          name={id}
          type={isPassword && visible ? 'text' : type}
          required={required}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass(error), prefix && 'pl-12', isPassword && 'pr-12')}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-muted hover:text-ink"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
    </Field>
  );
});
