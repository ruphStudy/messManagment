import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin', className)} aria-hidden />;
}

/** Full-area loader for route transitions and session restore. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-[50dvh] place-items-center text-ink-muted">
      <div className="flex items-center gap-2">
        <Spinner className="text-brand-600" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-slate-200', className)} />;
}
