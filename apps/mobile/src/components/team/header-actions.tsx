import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/avatar';
import { NotificationBell } from '@/components/notification-bell';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';

/** Team header (every tab/screen): notifications, Profile (initials) and Settings. */
export function TeamHeaderActions() {
  const { session } = useAuth();
  const name = session ? [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
      <NotificationBell href="/team/notifications" />
      <Pressable onPress={() => router.push('/team/profile')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Profile" style={{ paddingHorizontal: 6 }}>
        <Avatar name={name} size={28} />
      </Pressable>
      <Pressable onPress={() => router.push('/team/settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Settings" style={{ paddingHorizontal: 8 }}>
        <Ionicons name="settings-outline" size={24} color={colors.ink} />
      </Pressable>
    </View>
  );
}
