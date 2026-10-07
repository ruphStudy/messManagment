import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme/tokens';
import { Button } from './button';
import { AppText } from './text';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface StateProps {
  title: string;
  description?: string;
  icon?: IconName;
}

export function EmptyState({ title, description, icon = 'file-tray-outline' }: StateProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: colors.brand50 }]}>
        <Ionicons name={icon} size={30} color={colors.brand600} />
      </View>
      <AppText variant="title" style={styles.center}>
        {title}
      </AppText>
      {description && (
        <AppText muted style={styles.center}>
          {description}
        </AppText>
      )}
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  icon = 'cloud-offline-outline',
  onRetry,
}: Partial<StateProps> & { onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name={icon} size={30} color={colors.danger} />
      </View>
      <AppText variant="title" style={styles.center}>
        {title}
      </AppText>
      <AppText muted style={styles.center}>
        {description}
      </AppText>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: spacing.sm }} />}
    </View>
  );
}

export function FullScreenLoader() {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.canvas }]} accessibilityLabel="Loading">
      <ActivityIndicator size="large" color={colors.brand600} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  center: { textAlign: 'center' },
});
