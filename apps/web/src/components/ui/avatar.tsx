import { personInitials } from '@mess/shared';
import { cn } from '@/lib/cn';

/** Initials circle (no photos). Decorative: the name is always shown next to it. */
export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700', className)}>
      {personInitials(name)}
    </span>
  );
}

/** Avatar + name, for list rows. */
export function PersonName({ name, className, children }: { name: string; className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <Avatar name={name} />
      <span className="min-w-0 truncate">{children ?? name}</span>
    </span>
  );
}
