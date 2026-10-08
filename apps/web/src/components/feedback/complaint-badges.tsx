import { COMPLAINT_STATUS_LABELS, type ComplaintStatus } from '@mess/shared';
import { Badge } from '@/components/ui/badge';

const TONE = { OPEN: 'danger', IN_PROGRESS: 'warning', RESOLVED: 'success' } as const;

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  return <Badge tone={TONE[status]}>{COMPLAINT_STATUS_LABELS[status]}</Badge>;
}
