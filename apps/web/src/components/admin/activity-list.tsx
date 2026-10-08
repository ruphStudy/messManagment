import { AUDIT_ACTION_LABELS, type AuditLogItem } from '@mess/shared';
import { formatDateTime } from '@/lib/format';

export function ActivityList({ items, empty }: { items: AuditLogItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border text-sm">
      {items.map((a) => (
        <li key={a.id} className="py-2">
          <p><span className="font-medium">{AUDIT_ACTION_LABELS[a.action]}</span> · {a.targetLabel ?? a.targetType} by {a.actor.name}</p>
          <p className="text-ink-muted">{formatDateTime(a.createdAt)}{a.reason && ` · “${a.reason}”`}</p>
        </li>
      ))}
    </ul>
  );
}
