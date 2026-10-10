import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { Permission, ROLE_LABELS } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { ListItem } from '@/components/team/kit';
import { AppText } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { confirm, useCan } from '@/lib/team';

const ITEMS: { label: string; href: Href; icon: ComponentProps<typeof Ionicons>['name']; permission: Permission }[] = [
  { label: 'Meal pauses', href: '/team/pauses', icon: 'pause-circle-outline', permission: Permission.PAUSE_VIEW },
  { label: 'Meal plans', href: '/team/plans', icon: 'clipboard-outline', permission: Permission.MEAL_PLAN_VIEW },
  { label: 'Payments', href: '/team/payments', icon: 'cash-outline', permission: Permission.FINANCE_VIEW },
  { label: 'Pending dues', href: '/team/dues', icon: 'wallet-outline', permission: Permission.FINANCE_VIEW },
  { label: 'Expenses', href: '/team/expenses', icon: 'receipt-outline', permission: Permission.EXPENSE_VIEW },
  { label: 'Notifications', href: '/team/notifications', icon: 'notifications-outline', permission: Permission.MESS_VIEW },
  { label: 'Feedback', href: '/team/feedback', icon: 'star-outline', permission: Permission.FEEDBACK_VIEW },
  { label: 'Complaints', href: '/team/complaints', icon: 'chatbubble-ellipses-outline', permission: Permission.COMPLAINT_VIEW },
  { label: 'Reports', href: '/team/reports', icon: 'bar-chart-outline', permission: Permission.REPORTS_VIEW },
  { label: 'Staff', href: '/team/staff', icon: 'people-circle-outline', permission: Permission.STAFF_VIEW },
  { label: 'Billing & Subscription', href: '/team/billing', icon: 'card-outline', permission: Permission.MESS_SETTINGS_UPDATE },
  { label: 'Profile', href: '/team/profile', icon: 'person-circle-outline', permission: Permission.MESS_VIEW },
  { label: 'Settings', href: '/team/settings', icon: 'settings-outline', permission: Permission.MESS_VIEW },
];

/** Everything else the role can use (items it can't use are not shown; the API blocks them anyway). */
export default function MoreScreen() {
  const { session, logout } = useAuth();
  const can = useCan();
  return (
    <Screen edges={[]}>
      <AppText muted>{session ? `${session.user.firstName} · ${ROLE_LABELS[session.role]}` : ''}</AppText>
      {ITEMS.filter((i) => can(i.permission)).map((i) => <ListItem key={i.label} title={i.label} icon={i.icon} onPress={() => router.push(i.href)} />)}
      <Button title="Sign out" variant="secondary" onPress={() => confirm('Sign out?', 'You will need to sign in again.', 'Sign out', () => void logout(), true)} />
    </Screen>
  );
}
