import { useState } from 'react';
import { MESSAGES, ROLE_LABELS, validators, type AuthContext } from '@mess/shared';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { Row, SectionTitle } from '@/components/team/kit';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm, mutate } from '@/lib/team';

function AccountForm() {
  const { session, refreshSession } = useAuth();
  const toast = useToast();
  const [name, setName] = useState({ firstName: session?.user.firstName ?? '', lastName: session?.user.lastName ?? '', email: session?.user.email ?? '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const saveName = async () => {
    setBusy(true);
    const res = await mutate(() => api<AuthContext>('/auth/me', { method: 'PATCH', body: { firstName: name.firstName.trim(), lastName: name.lastName.trim() || null, email: name.email.trim() || null } }), toast, 'Details saved');
    if (res) await refreshSession();
    setBusy(false);
  };
  const changePw = async () => {
    const invalid = !pw.current ? MESSAGES.required : (validators.password(pw.next) ?? (pw.next !== pw.confirm ? MESSAGES.passwordMismatch : undefined));
    if (invalid) return setPwError(invalid);
    setBusy(true);
    setPwError(undefined);
    const res = await mutate(() => api<AuthContext>('/auth/change-password', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } }), toast, 'Password changed. Other devices were signed out.');
    if (res) setPw({ current: '', next: '', confirm: '' });
    setBusy(false);
  };
  return (
    <Card>
      <SectionTitle>Your details</SectionTitle>
      <TextField label="First name" value={name.firstName} onChangeText={(t) => setName({ ...name, firstName: t })} />
      <TextField label="Last name" value={name.lastName} onChangeText={(t) => setName({ ...name, lastName: t })} />
      <TextField label="Email" keyboardType="email-address" autoCapitalize="none" value={name.email} onChangeText={(t) => setName({ ...name, email: t })} />
      <Button title="Save details" variant="secondary" onPress={saveName} loading={busy} />
      <SectionTitle>Change password</SectionTitle>
      <TextField label="Current password" secureTextEntry value={pw.current} onChangeText={(t) => setPw({ ...pw, current: t })} />
      <TextField label="New password" secureTextEntry hint={MESSAGES.password} value={pw.next} onChangeText={(t) => setPw({ ...pw, next: t })} />
      <TextField label="Confirm new password" secureTextEntry value={pw.confirm} error={pwError} onChangeText={(t) => setPw({ ...pw, confirm: t })} />
      <Button title="Change password" variant="secondary" onPress={changePw} loading={busy} />
    </Card>
  );
}

/** Personal account only: who you are, your role, details, password, sign out (mess settings live in Settings). */
export default function TeamProfileScreen() {
  const { session, logout } = useAuth();
  if (!session) return null;
  const name = [session.user.firstName, session.user.lastName].filter(Boolean).join(' ');
  return (
    <Screen edges={[]}>
      <Card style={{ alignItems: 'center' }}>
        <Avatar name={name} size={64} />
        <AppText variant="label" style={{ marginTop: 8 }}>{name}</AppText>
        <AppText muted>{ROLE_LABELS[session.role]}{session.membership ? ` · ${session.membership.mess.name}` : ''}</AppText>
      </Card>
      <Card>
        <Row label="Mobile" value={session.user.mobile} />
        {session.user.email && <Row label="Email" value={session.user.email} />}
        <Row label="Role" value={ROLE_LABELS[session.role]} />
      </Card>
      <AccountForm />
      <Button title="Sign out" variant="secondary" onPress={() => confirm('Sign out?', 'You will need to sign in again.', 'Sign out', () => void logout(), true)} />
    </Screen>
  );
}
