import type { ReactNode } from 'react';
import { CloudOff, Inbox, type LucideIcon } from 'lucide-react';
import { Button } from './button';

interface StateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

function StateBlock({ title, description, icon: Icon = Inbox, action, tone }: StateProps & { tone: 'neutral' | 'danger' }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-10 text-center">
      <div className={tone === 'danger' ? 'rounded-full bg-danger-soft p-3 text-danger' : 'rounded-full bg-brand-50 p-3 text-brand-600'}>
        <Icon className="size-7" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateBlock {...props} tone="neutral" />;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  onRetry,
  icon = CloudOff,
}: Partial<StateProps> & { onRetry?: () => void }) {
  return (
    <StateBlock
      title={title}
      description={description}
      icon={icon}
      tone="danger"
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}
