'use client';

import { useEffect, useState } from 'react';
import { ADMIN_REASON_MAX } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api';

interface Props<T> {
  open: boolean;
  /** suspend: reason required; reactivate: reason optional. */
  mode: 'suspend' | 'reactivate';
  title: string;
  /** Plain-language impact of the action. */
  impact: string;
  /** e.g. /admin/messes/<id> — `/suspend` or `/reactivate` is appended. */
  path: string;
  onClose: () => void;
  onDone: (updated: T) => void;
}

/** Confirmation (with reason) for suspend/reactivate. Nothing is deleted either way. */
export function StatusChangeDialog<T>({ open, mode, title, impact, path, onClose, onDone }: Props<T>) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const suspending = mode === 'suspend';

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (suspending && !reason.trim()) return setError('Please give a reason.');
    setSaving(true);
    setError(null);
    try {
      onDone(await api<T>(`${path}/${mode}`, { method: 'POST', body: { reason: reason.trim() || undefined } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={impact}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant={suspending ? 'danger' : 'primary'} onClick={submit} loading={saving}>{suspending ? 'Suspend' : 'Reactivate'}</Button>
        </>
      }
    >
      <Textarea
        id="status-reason"
        label={suspending ? 'Reason (required)' : 'Note (optional)'}
        hint="Saved in the audit log."
        value={reason}
        maxLength={ADMIN_REASON_MAX}
        rows={3}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
    </Modal>
  );
}
