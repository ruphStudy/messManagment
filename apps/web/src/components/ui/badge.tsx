import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-success-soft text-green-800',
  warning: 'bg-warning-soft text-amber-800',
  danger: 'bg-danger-soft text-red-800',
  info: 'bg-info-soft text-blue-800',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}
