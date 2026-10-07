import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'danger' | 'success' | 'info';

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  danger: { box: 'border-red-200 bg-danger-soft text-red-800', Icon: AlertCircle },
  success: { box: 'border-green-200 bg-success-soft text-green-800', Icon: CheckCircle2 },
  info: { box: 'border-blue-200 bg-info-soft text-blue-800', Icon: Info },
};

/** Inline message, e.g. a form-level error above the submit button. */
export function Alert({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-2 rounded-control border p-3 text-sm', box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
