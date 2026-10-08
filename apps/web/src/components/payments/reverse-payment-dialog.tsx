'use client';

import { useEffect, useState } from 'react';
import { formatPaise, PAYMENT_LIMITS, type PaymentRecord } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { fullName } from '@/lib/format';

export function ReversePaymentDialog({ payment, onClose, onDone }: { payment: PaymentRecord | null; onClose: () => void; onDone: (p: PaymentRecord) => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setReason(''), [payment]);

  const reverse = async () => {
    if (!payment) return;
    setBusy(true);
    try {
      const updated = await api<PaymentRecord>(`/payments/${payment.id}/reverse`, { method: 'POST', body: reason.trim() ? { reason: reason.trim() } : {} });
      toast.success('Payment reversed', `${updated.receiptNumber} · due increased by ${formatPaise(updated.amountPaise)}`);
      onDone(updated);
    } catch (e) {
      toast.error('Could not reverse', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!payment}
      onClose={onClose}
      title="Reverse this payment?"
      description={payment ? `${payment.receiptNumber} · ${fullName(payment.student)} · ${formatPaise(payment.amountPaise)}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Keep payment</Button>
          <Button variant="danger" onClick={reverse} loading={busy}>Reverse payment</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-muted">Reversing this payment will increase the outstanding balance. The record stays in history, marked as reversed.</p>
      <Input id="reverse-reason" label="Reason (optional)" placeholder="e.g. Entered by mistake" maxLength={PAYMENT_LIMITS.noteMax} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}
