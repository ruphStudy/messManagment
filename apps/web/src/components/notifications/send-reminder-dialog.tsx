'use client';

import { useEffect, useState } from 'react';
import { NOTIFICATION_LIMITS, REMINDER_REASON_LABELS, ReminderReason, type ReminderResult } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/choice';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { api, errorMessage } from '@/lib/api';
import { ReminderResultSummary } from './reminder-result';

const HINTS: Record<ReminderReason, string> = {
  PAYMENT: 'The amount due is added automatically.',
  RENEWAL: 'Asks the student to contact you to renew.',
  CONTACT_MESS: 'Asks the student to contact the mess.',
  GENERAL: 'A short general reminder.',
};

/** Reminder to one student: a fixed reason plus an optional short note. No free-form broadcasts. */
export function SendReminderDialog({ open, student, onClose }: { open: boolean; student: { id: string; name: string }; onClose: () => void }) {
  const [reason, setReason] = useState<ReminderReason>(ReminderReason.PAYMENT);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ReminderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason(ReminderReason.PAYMENT);
    setNote('');
    setResult(null);
    setError(null);
  }, [open]);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      setResult(await api<ReminderResult>(`/students/${student.id}/reminders`, { method: 'POST', body: { reason, ...(note.trim() ? { note: note.trim() } : {}) } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send reminder"
      description={student.name}
      footer={result ? <Button onClick={onClose}>Done</Button> : (
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={send} loading={sending}>Send reminder</Button>
        </>
      )}
    >
      {result ? <ReminderResultSummary result={result} /> : (
        <div className="flex flex-col gap-4">
          <RadioGroup
            name="reason"
            label="Reminder about"
            value={reason}
            onChange={setReason}
            options={Object.values(ReminderReason).map((r) => ({ value: r, label: REMINDER_REASON_LABELS[r], description: HINTS[r] }))}
          />
          <Input id="reminder-note" label="Short note (optional)" maxLength={NOTIFICATION_LIMITS.noteMax} hint={`${note.length}/${NOTIFICATION_LIMITS.noteMax}`} value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="text-sm text-ink-muted">The student sees this in the app (and as a push notification if they allow it).</p>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
