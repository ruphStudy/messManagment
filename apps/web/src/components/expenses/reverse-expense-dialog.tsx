'use client';

import { useEffect, useState } from 'react';
import { EXPENSE_LIMITS, formatPaise, type Expense } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';

export function ReverseExpenseDialog({ expense, onClose, onDone }: { expense: Expense | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setReason(''), [expense]);

  const reverse = async () => {
    if (!expense) return;
    setBusy(true);
    try {
      await api(`/expenses/${expense.id}/reverse`, { method: 'POST', body: reason.trim() ? { reason: reason.trim() } : {} });
      toast.success('Expense removed from totals', expense.title);
      onDone();
    } catch (e) {
      toast.error('Could not reverse', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!expense}
      onClose={onClose}
      title="Remove / reverse this expense?"
      description={expense ? `${expense.title} · ${formatPaise(expense.amountPaise)}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Keep it</Button>
          <Button variant="danger" onClick={reverse} loading={busy}>Reverse expense</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-muted">This expense will be removed from totals but kept in history, marked as reversed.</p>
      <Input id="expense-reverse-reason" label="Reason (optional)" placeholder="e.g. Entered twice" maxLength={EXPENSE_LIMITS.noteMax} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}
