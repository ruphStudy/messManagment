import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { controlClass, describedBy, Field } from './field';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, error, hint, required, className, rows = 3, ...props },
  ref,
) {
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <textarea
        ref={ref}
        id={id}
        name={id}
        rows={rows}
        required={required}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass(error), 'h-auto py-2.5')}
        {...props}
      />
    </Field>
  );
});
