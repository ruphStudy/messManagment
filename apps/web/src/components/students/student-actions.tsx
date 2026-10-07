'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, Pencil, Power } from 'lucide-react';
import { can, Permission, StudentStatus, type StudentDetail } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { fullName } from '@/lib/format';

type Action = 'activate' | 'deactivate' | 'archive' | 'restore';

const ACTIONS: Record<Action, { path: string; body?: object; success: string }> = {
  activate: { path: 'status', body: { status: StudentStatus.ACTIVE }, success: 'Student activated' },
  deactivate: { path: 'status', body: { status: StudentStatus.INACTIVE }, success: 'Student deactivated' },
  archive: { path: 'archive', success: 'Student archived' },
  restore: { path: 'restore', success: 'Student restored' },
};

/** Edit / status / archive buttons. Only actions the user's role allows are shown; the API enforces the same rules. */
export function StudentActions({ student, onChange }: { student: StudentDetail; onChange: (s: StudentDetail) => void }) {
  const { session } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState<'deactivate' | 'archive' | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);

  const canManage = can(session?.role, Permission.STUDENT_MANAGE);
  const canArchive = can(session?.role, Permission.STUDENT_ARCHIVE);
  const archived = student.status === StudentStatus.ARCHIVED;
  const name = fullName(student);

  const run = async (action: Action) => {
    const { path, body, success } = ACTIONS[action];
    setBusy(action);
    try {
      const method = path === 'status' ? 'PATCH' : 'POST';
      const updated = await api<StudentDetail>(`/students/${student.id}/${path}`, { method, body });
      onChange(updated);
      toast.success(success, name);
      setConfirm(null);
    } catch (error) {
      toast.error('Could not update student', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {canManage && !archived && (
        <Link
          href={`/students/${student.id}/edit`}
          className="inline-flex h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-semibold hover:bg-canvas"
        >
          <Pencil className="size-4" aria-hidden /> Edit
        </Link>
      )}
      {canManage && !archived && student.status === StudentStatus.ACTIVE && (
        <Button variant="secondary" onClick={() => setConfirm('deactivate')}>
          <Power className="size-4" aria-hidden /> Deactivate
        </Button>
      )}
      {canManage && student.status === StudentStatus.INACTIVE && (
        <Button variant="secondary" loading={busy === 'activate'} onClick={() => run('activate')}>
          <Power className="size-4" aria-hidden /> Activate
        </Button>
      )}
      {canArchive && !archived && (
        <Button variant="ghost" className="text-danger" onClick={() => setConfirm('archive')}>
          <Archive className="size-4" aria-hidden /> Archive
        </Button>
      )}
      {canArchive && archived && (
        <Button variant="secondary" loading={busy === 'restore'} onClick={() => run('restore')}>
          <ArchiveRestore className="size-4" aria-hidden /> Restore
        </Button>
      )}

      <ConfirmDialog
        open={confirm === 'deactivate'}
        title={`Deactivate ${name}?`}
        description="They will be marked inactive. You can activate them again anytime."
        confirmLabel="Deactivate"
        loading={busy === 'deactivate'}
        onConfirm={() => run('deactivate')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'archive'}
        title={`Archive ${name}?`}
        description="They will be removed from your student list but their record is kept. Their app account is not deleted. You can restore them later from the Archived filter."
        confirmLabel="Archive"
        tone="danger"
        loading={busy === 'archive'}
        onConfirm={() => run('archive')}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
