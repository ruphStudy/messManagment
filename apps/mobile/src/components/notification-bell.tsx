import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/lib/notifications';
import { colors } from '@/theme/tokens';
import { AppText } from './text';

export function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={10}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.ink} />
      {unread > 0 && (
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>{unread > 99 ? '99+' : unread}</AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 16, paddingVertical: 4 },
  badge: { position: 'absolute', right: 8, top: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
