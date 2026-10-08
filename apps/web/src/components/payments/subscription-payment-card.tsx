'use client';

import { useCallback, useEffect, useState } from 'react';
import { can, formatPaise, Permission, SubscriptionStatus, type PaymentRecord, type SubscriptionSummary } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/auth-context';
import { api } from '@/lib/api';
import { PaymentStatusBadge } from './payment-badges';
import { RecentPayments } from './recent-payments';
import { RecordPaymentDialog } from './record-payment-dialog';

/** Fee / paid / due for one subscription, its payments and a Record payment button. */
export function SubscriptionPaymentCard({ sub, student, onChanged }: { sub: SubscriptionSummary; student: { id: string; name: string }; onChanged: () => void }) {
  const { session } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [recording, setRecording] = useState(false);
  const load = useCallback(() => {
    api<PaymentRecord[]>(`/payments?subscriptionId=${sub.id}&pageSize=10`).then(setPayments).catch(() => setPayments([]));
  }, [sub.id]);
  useEffect(load, [load]);

  const canRecord = can(session?.role, Permission.PAYMENT_RECORD) && sub.status !== SubscriptionStatus.CANCELLED && sub.payment.duePaise > 0;
  const { payablePaise, paidPaise, duePaise, status } = sub.payment;

  return (
    <Card>
      <CardHeader title="Payment" action={<PaymentStatusBadge status={status} />} />
      <dl className="mb-4 grid grid-cols-3 gap-3">
        <div><dt className="text-sm text-ink-muted">Fee</dt><dd className="text-lg font-bold">{formatPaise(payablePaise)}</dd></div>
        <div><dt className="text-sm text-ink-muted">Paid</dt><dd className="text-lg font-bold text-success">{formatPaise(paidPaise)}</dd></div>
        <div><dt className="text-sm text-ink-muted">Due</dt><dd className="text-lg font-bold text-danger">{formatPaise(duePaise)}</dd></div>
      </dl>
      {canRecord && <Button className="mb-3" onClick={() => setRecording(true)}>Record payment</Button>}
      {sub.status === SubscriptionStatus.CANCELLED && duePaise > 0 && <p className="mb-3 text-sm text-ink-muted">Cancelled subscriptions can&apos;t receive new payments.</p>}
      {payments && <RecentPayments payments={payments} />}
      <RecordPaymentDialog
        open={recording}
        student={student}
        subscriptionId={sub.id}
        onClose={() => setRecording(false)}
        onDone={() => { setRecording(false); load(); onChanged(); }}
      />
    </Card>
  );
}
