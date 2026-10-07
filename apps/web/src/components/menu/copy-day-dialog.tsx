'use client';

import { useEffect, useState } from 'react';
import { addDays, ErrorCode, type DailyMenu } from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { longDate, shortDate } from '@/lib/menu';

interface Props {
  open: boolean;
  /** Destination date. */
  date: string;
  /** Whether the destination already has a menu (asks to confirm replacing it). */
  hasMenu: boolean;
  onClose: () => void;
  onCopied: (menu: DailyMenu) => void;
}

/** Copies another day's menu (default: the previous day) into `date` as a draft. */
export function CopyDayDialog({ open, date, hasMenu, onClose, onCopied }: Props) {
  const toast = useToast();
  const [sourceDate, setSourceDate] = useState(addDays(date, -1));
  const [needsReplace, setNeedsReplace] = useState(hasMenu);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourceDate(addDays(date, -1));
    setNeedsReplace(hasMenu);
    setError(null);
  }, [open, date, hasMenu]);

  const copy = async () => {
    setBusy(true);
    setError(null);
    try {
      const menu = await api<DailyMenu>(`/menus/${date}/copy-from`, { method: 'POST', body: { sourceDate, replace: needsReplace } });
      toast.success('Menu copied as draft', `From ${shortDate(sourceDate)}`);
      onCopied(menu);
    } catch (e) {
      // Someone created a menu here meanwhile: switch to an explicit "replace" confirmation.
      if (e instanceof ApiError && e.code === ErrorCode.MENU_EXISTS) setNeedsReplace(true);
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copy menu from another day"
      description={`Into ${longDate(date)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={needsReplace ? 'danger' : 'primary'} onClick={copy} loading={busy}>
            {needsReplace ? 'Replace menu' : 'Copy menu'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input id="sourceDate" type="date" label="Copy from" value={sourceDate} hint={sourceDate ? longDate(sourceDate) : undefined} onChange={(e) => setSourceDate(e.target.value)} />
        {needsReplace && (
          <Alert tone="danger">This day already has a menu. It will be replaced and set back to draft.</Alert>
        )}
        {!needsReplace && <p className="text-sm text-ink-muted">The copy is saved as a draft so you can check it before publishing.</p>}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}
