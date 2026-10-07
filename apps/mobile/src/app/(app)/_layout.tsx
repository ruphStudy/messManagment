import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StudentProfileProvider } from '@/lib/student-profile';
import { colors } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline' },
  { name: 'menu', title: 'Menu', icon: 'restaurant-outline' },
  { name: 'qr', title: 'QR', icon: 'qr-code-outline' },
  { name: 'pause', title: 'Pause', icon: 'pause-circle-outline' },
  { name: 'payments', title: 'Payments', icon: 'wallet-outline' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline' },
];

export default function AppTabsLayout() {
  return (
    <StudentProfileProvider>
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ title, tabBarIcon: ({ color, size }) => <Ionicons name={icon} color={color} size={size} /> }}
        />
      ))}
      {/* Not a tab: opened from Home / Profile. */}
      <Tabs.Screen
        name="plans"
        options={{
          href: null,
          title: 'Plan history',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={12} style={{ paddingHorizontal: 16 }}>
              <Ionicons name="arrow-back" size={24} color={colors.ink} />
            </Pressable>
          ),
        }}
      />
    </Tabs>
    </StudentProfileProvider>
  );
}
