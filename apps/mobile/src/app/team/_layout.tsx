import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { resolveSession } from '@mess/shared';
import { TeamHeaderActions } from '@/components/team/header-actions';
import { useAuth } from '@/lib/auth';
import { NotificationsProvider } from '@/lib/notifications';
import { colors } from '@/theme/tokens';
import PasswordChangeScreen from '@/components/team/password-change';
import NoContextScreen from '@/components/team/no-context';
import MessSetupScreen from '@/components/team/mess-setup';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline' },
  { name: 'students', title: 'Students', icon: 'people-outline' },
  { name: 'menu', title: 'Menu', icon: 'restaurant-outline' },
  { name: 'attendance', title: 'Attendance', icon: 'checkmark-done-outline' },
  { name: 'more', title: 'More', icon: 'grid-outline' },
];

/** Opened from tabs / More; each screen checks its own permission (and the API enforces it). */
const SCREENS: { name: string; title: string }[] = [
  { name: 'student', title: 'Student' },
  { name: 'student-form', title: 'Student' },
  { name: 'subscription', title: 'Meal plan' },
  { name: 'plans', title: 'Meal plans' },
  { name: 'plan-form', title: 'Meal plan' },
  { name: 'scan', title: 'Scan QR' },
  { name: 'manual', title: 'Manual attendance' },
  { name: 'menu-edit', title: 'Edit menu' },
  { name: 'pauses', title: 'Meal pauses' },
  { name: 'pause-new', title: 'Add pause' },
  { name: 'payments', title: 'Payments' },
  { name: 'dues', title: 'Pending dues' },
  { name: 'payment-new', title: 'Record payment' },
  { name: 'receipt', title: 'Receipt' },
  { name: 'expenses', title: 'Expenses' },
  { name: 'expense-form', title: 'Expense' },
  { name: 'notifications', title: 'Notifications' },
  { name: 'feedback', title: 'Feedback' },
  { name: 'complaints', title: 'Complaints' },
  { name: 'complaint', title: 'Complaint' },
  { name: 'staff', title: 'Staff' },
  { name: 'staff-member', title: 'Team member' },
  { name: 'staff-form', title: 'Team member' },
  { name: 'settings', title: 'Settings' },
  { name: 'profile', title: 'Profile' },
  { name: 'billing', title: 'Billing & Subscription' },
  { name: 'reports', title: 'Reports' },
];

/** Owner / manager / staff app. Same sign-in and permissions as the web; the role decides what shows. */
export default function TeamLayout() {
  const { session } = useAuth();
  const mode = session ? resolveSession(session).mode : null;
  // Temporary password first (the API blocks everything else too). An owner without a mess sets one up
  // (also after refresh/reopen); managers/staff without a mess and platform admins get an info screen.
  if (mode === 'PASSWORD_CHANGE') return <PasswordChangeScreen />;
  if (mode === 'NO_CONTEXT' && session?.role === 'MESS_OWNER') return <MessSetupScreen />;
  if (mode !== 'TEAM') return <NoContextScreen />;

  return (
    <NotificationsProvider area="team">
      <Tabs
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.canvas },
          headerTitleStyle: { fontWeight: '700' },
          tabBarActiveTintColor: colors.brand600,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          headerRight: () => <TeamHeaderActions />,
        }}
      >
        {TABS.map(({ name, title, icon }) => (
          <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color, size }) => <Ionicons name={icon} color={color} size={size} /> }} />
        ))}
        {SCREENS.map(({ name, title }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              href: null,
              title,
              headerLeft: () => (
                <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={12} style={{ paddingHorizontal: 16 }}>
                  <Ionicons name="arrow-back" size={24} color={colors.ink} />
                </Pressable>
              ),
            }}
          />
        ))}
      </Tabs>
    </NotificationsProvider>
  );
}
