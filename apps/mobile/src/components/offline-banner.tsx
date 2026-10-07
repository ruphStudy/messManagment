import { StyleSheet, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/tokens';
import { AppText } from './text';

export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  const insets = useSafeAreaInsets();
  if (isConnected !== false) return null;
  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.xs }]} accessibilityLiveRegion="polite">
      <AppText variant="caption" style={styles.text}>
        You are offline. Check your internet connection.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.ink, paddingBottom: spacing.xs + 2, zIndex: 10 },
  text: { color: '#fff', textAlign: 'center' },
});
