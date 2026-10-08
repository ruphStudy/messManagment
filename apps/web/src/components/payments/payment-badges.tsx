import { PAYMENT_STATUS_LABELS, type PaymentTransactionStatus, type SubscriptionPaymentStatus } from '@mess/shared';
import { Badge } from '@/components/ui/badge';

const TONE = { PAID: 'success', PARTIAL: 'warning', UNPAID: 'danger' } as const;

export function PaymentStatusBadge({ status }: { status: SubscriptionPaymentStatus }) {
  return <Badge tone={TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function TransactionBadge({ status }: { status: PaymentTransactionStatus }) {
  return status === 'REVERSED' ? <Badge tone="danger">Reversed</Badge> : <Badge tone="success">Received</Badge>;
}
