'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, KeyRound, Pencil, Power } from 'lucide-react';
import { Permission, Role, ROLE_LABELS, STAFF_STATUS_LABELS, validators, type StaffDetail } from '@mess/shared';
import { StaffForm, TemporaryPasswordField, generateTemporaryPassword } from '@/components/staff/staff-form';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { formatDate, formatDateTime, fullName } from '@/lib/format';

function ResetPasswordDialog({ staff, open, onClose, onDone }: { staff: StaffDetail; open: boolean; onClose: () => void; onDone: (s: StaffDetail) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setPassword(generateTemporaryPassword());
      setError(null);
    }
  }, [open]);
  const submit = async () => {
    const invalid = validators.password(password);
    if (invalid) return setError(invalid);
    setSaving(true);
    try {
      onDone(await api<StaffDetail>(`/staff/${staff.id}/reset-password`, { method: 'POST', body: { temporaryPassword: password } }));
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
      title={`Reset ${staff.firstName}'s password?`}
      description="Their current password stops working and they are signed out everywhere. They must choose a new password after signing in with this one."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={saving}>Reset password</Button>
        </>
      }
    >
      <TemporaryPasswordField value={password} onChange={setPassword} />
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
    </Modal>
  );
}

function StaffDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setError(null);
    api<StaffDetail>(`/staff/${id}`).then(setStaff).catch((e: unknown) => setError(errorMessage(e)));
  }, [id, attempt]);

  if (error) return <ErrorState title="Couldn't load this team member" description={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!staff) return <Skeleton className="h-64" />;

  const active = staff.status === 'ACTIVE';
  const { actions } = staff;
  const toggleStatus = async () => {
    setStatusSaving(true);
    setStatusError(null);
    try {
      setStaff(await api<StaffDetail>(`/staff/${staff.id}/status`, { method: 'POST', body: { status: active ? 'INACTIVE' : 'ACTIVE' } }));
      setStatusDialog(false);
      toast.success(active ? 'Access removed' : 'Access restored');
    } catch (e) {
      setStatusError(errorMessage(e));
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <>
      <Link href="/staff" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden /> Team</Link>
      <PageHeader
        title={fullName(staff)}
        description={`${ROLE_LABELS[staff.role]} · added ${formatDate(staff.addedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {actions.edit && !editing && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" aria-hidden /> Edit</Button>}
            {actions.resetPassword && active && <Button variant="secondary" onClick={() => setResetting(true)}><KeyRound className="size-4" aria-hidden /> Reset password</Button>}
            {actions.setStatus && (
              <Button variant={active ? 'danger' : 'primary'} onClick={() => setStatusDialog(true)}><Power className="size-4" aria-hidden /> {active ? 'Deactivate' : 'Reactivate'}</Button>
            )}
          </div>
        }
      />
      {staff.role === Role.MESS_OWNER && <Alert tone="info" className="mb-4">The owner always keeps full access. Ownership can’t be changed here.</Alert>}
      {staff.isSelf && staff.role !== Role.MESS_OWNER && <Alert tone="info" className="mb-4">This is you. Change your own details under Settings → Account.</Alert>}
      {staff.accountStatus === 'DISABLED' && <Alert tone="danger" className="mb-4">This account has been suspended by the platform team.</Alert>}

      {editing ? (
        <Card className="max-w-2xl">
          <CardHeader title="Edit team member" />
          <StaffForm
            mode="edit"
            roles={staff.assignableRoles}
            submitLabel="Save changes"
            initial={{ firstName: staff.firstName, lastName: staff.lastName ?? '', mobile: staff.mobile, email: staff.email ?? '', role: staff.role as 'MESS_MANAGER' | 'MESS_STAFF', temporaryPassword: '' }}
            onCancel={() => setEditing(false)}
            onSubmit={async (v) => {
              const updated = await api<StaffDetail>(`/staff/${staff.id}`, {
                method: 'PATCH',
                body: { firstName: v.firstName.trim(), lastName: v.lastName.trim() || null, email: v.email.trim() || null, ...(v.role !== staff.role ? { role: v.role } : {}) },
              });
              setStaff(updated);
              setEditing(false);
              toast.success('Saved');
            }}
          />
        </Card>
      ) : (
        <Card>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-ink-muted">Status</dt>
            <dd><Badge tone={active ? 'success' : 'neutral'}>{STAFF_STATUS_LABELS[staff.status]}</Badge>{!active && <span className="ml-2 text-ink-muted">Cannot access this mess</span>}</dd>
            <dt className="text-ink-muted">Role</dt><dd>{ROLE_LABELS[staff.role]}</dd>
            <dt className="text-ink-muted">Mobile</dt><dd>{staff.mobile}</dd>
            <dt className="text-ink-muted">Email</dt><dd>{staff.email ?? '—'}</dd>
            <dt className="text-ink-muted">Added</dt><dd>{formatDate(staff.addedAt)}</dd>
            <dt className="text-ink-muted">Last sign-in</dt><dd>{staff.lastLoginAt ? formatDateTime(staff.lastLoginAt) : 'Never'}</dd>
            {staff.mustChangePassword && <><dt className="text-ink-muted">Password</dt><dd>Temporary — they will be asked to change it</dd></>}
          </dl>
        </Card>
      )}

      <ConfirmDialog
        open={statusDialog}
        title={active ? `Deactivate ${staff.firstName}?` : `Reactivate ${staff.firstName}?`}
        description={
          (active
            ? 'This staff member will no longer be able to access this mess and is signed out everywhere. Their history is kept and you can reactivate them later.'
            : 'They can sign in and work in this mess again with their existing password.') + (statusError ? ` — ${statusError}` : '')
        }
        confirmLabel={active ? 'Deactivate' : 'Reactivate'}
        tone={active ? 'danger' : 'primary'}
        loading={statusSaving}
        onConfirm={toggleStatus}
        onCancel={() => { setStatusDialog(false); setStatusError(null); }}
      />
      <ResetPasswordDialog
        staff={staff}
        open={resetting}
        onClose={() => setResetting(false)}
        onDone={(s) => { setStaff(s); setResetting(false); toast.success('Password reset. Share the new temporary password in person.'); }}
      />
    </>
  );
}

export default function StaffDetailPage() {
  return (
    <RequireAuth permission={Permission.STAFF_VIEW}>
      <StaffDetailScreen />
    </RequireAuth>
  );
}
