import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { displayName, useAuth } from '@/lib/auth';
import { colors, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { session } = useAuth();
  const messName = session?.membership?.mess.name;

  return (
    <Screen edges={[]}>
      <View style={styles.greeting}>
        <AppText variant="display">Welcome!</AppText>
        <AppText muted>{displayName(session)}</AppText>
      </View>

      <Card>
        <View style={styles.row}>
          <Ionicons name={messName ? 'storefront-outline' : 'time-outline'} size={24} color={colors.brand600} />
          <AppText variant="title" style={styles.flex}>
            {messName ?? 'Waiting for your mess'}
          </AppText>
        </View>
        <AppText muted>
          {messName
            ? 'Your mess features will appear here soon.'
            : 'Once your mess owner adds your number, your subscription, menu and QR will appear here.'}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
