'use client';

import { useState } from 'react';
import { MEAL_LABELS, type PauseRecord } from '@mess/shared';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { fullName } from '@/lib/format';
import { shortDate } from '@/lib/menu';

export function CancelPauseDialog({ pause, onClose, onDone }: { pause: PauseRecord | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    if (!pause) return;
    setBusy(true);
    try {
      await api(`/pauses/${pause.id}/cancel`, { method: 'POST' });
      toast.success('Pause cancelled', `${MEAL_LABELS[pause.mealType]} on ${shortDate(pause.date)} is back on.`);
      onDone();
    } catch (e) {
      toast.error('Could not cancel pause', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      open={!!pause}
      title="Cancel this pause?"
      description={pause ? `${fullName(pause.student)} will be expected for ${MEAL_LABELS[pause.mealType]} on ${shortDate(pause.date)}. The pause stays in history.` : undefined}
      confirmLabel="Cancel pause"
      cancelLabel="Keep pause"
      loading={busy}
      onConfirm={cancel}
      onCancel={onClose}
    />
  );
}
