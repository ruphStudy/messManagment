import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_COUNTRY_CODE } from '@mess/shared';
import { colors, spacing } from '@/theme/tokens';
import { Card } from './layout';
import { AppText } from './text';

/** Shown when the login is valid but no mess has added this mobile number yet. */
export function NotLinkedCard({ mobile }: { mobile: string }) {
  return (
    <Card>
      <View style={styles.row}>
        <Ionicons name="hourglass-outline" size={24} color={colors.brand600} />
        <AppText variant="title" style={styles.flex}>
          Not linked to a mess yet
        </AppText>
      </View>
      <AppText muted>
        Your account is ready, but your mess has not linked your mobile number yet. Please contact your mess owner and ask them to
        add {DEFAULT_COUNTRY_CODE} {mobile}.
      </AppText>
      <AppText variant="caption" muted>
        Pull down to refresh once they have added you.
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
