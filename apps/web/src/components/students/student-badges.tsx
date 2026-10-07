import { Smartphone } from 'lucide-react';
import { STUDENT_STATUS_LABELS, StudentStatus } from '@mess/shared';
import { Badge } from '@/components/ui/badge';

const STATUS_TONE = { ACTIVE: 'success', INACTIVE: 'warning', ARCHIVED: 'neutral' } as const;

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STUDENT_STATUS_LABELS[status]}</Badge>;
}

export function AppLinkBadge({ linked }: { linked: boolean }) {
  return linked ? (
    <Badge tone="info">
      <Smartphone className="mr-1 size-3" aria-hidden /> Linked
    </Badge>
  ) : (
    <Badge>Not linked</Badge>
  );
}
