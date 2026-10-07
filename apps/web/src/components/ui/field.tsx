import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error wrapper shared by all form controls. */
export function Field({ id, label, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const controlClass = (error?: string) =>
  cn(
    'h-11 w-full rounded-control border bg-surface px-3 text-base text-ink placeholder:text-slate-400',
    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-canvas disabled:text-ink-muted',
    error ? 'border-danger' : 'border-border',
  );

export function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}
