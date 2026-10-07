import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { DEFAULT_COUNTRY_CODE, ROLE_LABELS } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { displayName, useAuth } from '@/lib/auth';
import { colors, spacing } from '@/theme/tokens';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText muted>{label}</AppText>
      <AppText style={styles.value}>{value}</AppText>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, logout } = useAuth();
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!session) return null;
  const { user } = session;

  const confirmLogout = () =>
    Alert.alert('Sign out?', 'You will need your mobile number and a code to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout().catch(() => toast.show('Signed out on this device', 'info'));
        },
      },
    ]);

  return (
    <Screen edges={[]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <AppText variant="title" style={{ color: colors.brand700 }}>
            {(user.firstName[0] ?? '#').toUpperCase()}
          </AppText>
        </View>
        <AppText variant="title">{displayName(session)}</AppText>
      </View>

      <Card>
        <Row label="Mobile" value={`${DEFAULT_COUNTRY_CODE} ${user.mobile}`} />
        <Row label="Account" value={ROLE_LABELS[session.role]} />
        <Row label="Mess" value={session.membership?.mess.name ?? 'Not linked yet'} />
      </Card>

      <Button title="Sign out" variant="secondary" onPress={confirmLogout} loading={loggingOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, gap: spacing.md },
  value: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
