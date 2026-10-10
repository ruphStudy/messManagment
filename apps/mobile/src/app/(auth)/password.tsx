import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { TextField } from '@/components/text-field';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme/tokens';

/** Password sign-in for owners, managers and staff (accounts created on web or by their mess work here too). */
export default function PasswordLoginScreen() {
  const { passwordLogin } = useAuth();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const [identifier, setIdentifier] = useState(params.identifier ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!identifier.trim() || !password) return setError('Enter your mobile number (or email) and password');
    setLoading(true);
    setError(undefined);
    try {
      await passwordLogin(identifier.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <AppText variant="display">Sign in</AppText>
        <AppText muted>Owner, manager or staff: use the mobile number (or email) and password for your account.</AppText>
      </View>
      <TextField label="Mobile number or email" autoCapitalize="none" autoComplete="username" value={identifier} onChangeText={setIdentifier} />
      <TextField label="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} error={error} returnKeyType="done" onSubmitEditing={submit} />
      <Button title="Sign in" onPress={submit} loading={loading} />
      <AppText variant="caption" muted style={styles.note}>
        Manager or staff? Your mess owner creates your account — sign in with the details they gave you.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, marginBottom: spacing.lg },
  note: { textAlign: 'center', marginTop: spacing.md },
});
