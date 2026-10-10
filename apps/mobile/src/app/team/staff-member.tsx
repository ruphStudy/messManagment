import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ROLE_LABELS, STAFF_STATUS_LABELS, validators, type StaffDetail } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { Row } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { generateTemporaryPassword } from '@/components/team/temp-password';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { confirm, mutate, useApi } from '@/lib/team';

/** Team member detail; only the actions the API says this user may take are shown. */
export default function StaffMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { data: m, setData, error, reload } = useApi<StaffDetail>(`/staff/${id}`);
  const [tempPw, setTempPw] = useState(generateTemporaryPassword());
  const [busy, setBusy] = useState(false);
  if (error && !m) return <ErrorState title="Couldn't load this team member" description={error} onRetry={reload} />;
  if (!m) return <FullScreenLoader />;
  const active = m.status === 'ACTIVE';
  const run = async (path: string, body: object, done: string) => {
    setBusy(true);
    const res = await mutate(() => api<StaffDetail>(`/staff/${m.id}/${path}`, { method: 'POST', body }), toast, done);
    if (res) setData(res);
    setBusy(false);
  };
  return (
    <Screen edges={[]} onRefresh={reload} refreshing={false}>
      <SuspendedBanner />
      <Card>
        <AppText variant="title">{[m.firstName, m.lastName].filter(Boolean).join(' ')}</AppText>
        <Row label="Role" value={ROLE_LABELS[m.role]} />
        <Row label="Status" value={STAFF_STATUS_LABELS[m.status]} />
        <Row label="Mobile" value={m.mobile} />
        <Row label="Email" value={m.email ?? '—'} />
        <Row label="Added" value={formatDate(m.addedAt.slice(0, 10))} />
        <Row label="Last sign-in" value={m.lastLoginAt ? formatDate(m.lastLoginAt.slice(0, 10)) : 'Never'} />
        {m.mustChangePassword && <AppText variant="caption" muted>Temporary password — they will be asked to change it.</AppText>}
      </Card>
      {m.role === 'MESS_OWNER' && <AppText muted>The owner always keeps full access.</AppText>}
      {m.isSelf && m.role !== 'MESS_OWNER' && <AppText muted>This is you — change your own details in Settings.</AppText>}
      {m.actions.edit && <Button title="Edit / change role" variant="secondary" onPress={() => router.push({ pathname: '/team/staff-form', params: { id: m.id } })} />}
      {m.actions.resetPassword && active && (
        <Card>
          <TextField label="New temporary password" value={tempPw} onChangeText={setTempPw} hint="Share it in person. They must change it at sign-in." />
          <Button title="Generate another" variant="ghost" onPress={() => setTempPw(generateTemporaryPassword())} />
          <Button
            title="Reset password"
            variant="danger"
            loading={busy}
            disabled={!!validators.password(tempPw)}
            onPress={() => confirm(`Reset ${m.firstName}'s password?`, 'Their current password stops working and they are signed out everywhere.', 'Reset', () => void run('reset-password', { temporaryPassword: tempPw }, 'Password reset'), true)}
          />
        </Card>
      )}
      {m.actions.setStatus && (
        <Button
          title={active ? 'Deactivate' : 'Reactivate'}
          variant={active ? 'danger' : 'primary'}
          loading={busy}
          onPress={() =>
            confirm(
              active ? `Deactivate ${m.firstName}?` : `Reactivate ${m.firstName}?`,
              active ? 'This staff member will no longer be able to access this mess and is signed out everywhere. History is kept.' : 'They can sign in and work here again.',
              active ? 'Deactivate' : 'Reactivate',
              () => void run('status', { status: active ? 'INACTIVE' : 'ACTIVE' }, active ? 'Access removed' : 'Access restored'),
              active,
            )
          }
        />
      )}
    </Screen>
  );
}
