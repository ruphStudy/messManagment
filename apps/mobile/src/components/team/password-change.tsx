import { useState } from 'react';
import { MESSAGES, ROLE_LABELS, validators, type AuthContext } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Temporary password: only this flow is available (the API blocks every other call) until it is changed. */
export default function PasswordChangeScreen() {
  const { session, refreshSession, logout } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    const invalid = !current ? MESSAGES.required : (validators.password(next) ?? (next !== confirmValue ? MESSAGES.passwordMismatch : undefined));
    if (invalid) return setError(invalid);
    setLoading(true);
    setError(undefined);
    try {
      await api<AuthContext>('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      await refreshSession();
      toast.show('Password changed', 'success');
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };
  return (
    <Screen>
      <AppText variant="display">Set your password</AppText>
      <AppText muted>{session ? `${ROLE_LABELS[session.role]}${session.membership ? ` · ${session.membership.mess.name}` : ''}` : ''}</AppText>
      <Card>
        <AppText muted>You signed in with a temporary password. Choose your own to continue.</AppText>
        <TextField label="Current (temporary) password" secureTextEntry value={current} onChangeText={setCurrent} />
        <TextField label="New password" secureTextEntry hint={MESSAGES.password} value={next} onChangeText={setNext} />
        <TextField label="Confirm new password" secureTextEntry value={confirmValue} onChangeText={setConfirmValue} error={error} />
        <Button title="Change password" onPress={submit} loading={loading} />
      </Card>
      <Button title="Sign out" variant="secondary" onPress={() => void logout()} />
    </Screen>
  );
}
