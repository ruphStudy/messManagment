import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  PauseCircle,
  Settings,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { can, Permission, type Role } from '@mess/shared';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  /** Shown disabled with a "Soon" badge until the module ships. */
  soon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: Permission.MESS_VIEW },
  { label: 'Students', href: '/students', icon: Users, soon: true },
  { label: 'Meal Plans', href: '/meal-plans', icon: ClipboardList, soon: true },
  { label: 'Menu', href: '/menu', icon: UtensilsCrossed, soon: true },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck, soon: true },
  { label: 'Meal Pause', href: '/meal-pause', icon: PauseCircle, soon: true },
  { label: 'Payments', href: '/payments', icon: CreditCard, soon: true },
  { label: 'Expenses', href: '/expenses', icon: Wallet, soon: true },
  { label: 'Feedback', href: '/feedback', icon: MessageSquare, soon: true },
  { label: 'Reports', href: '/reports', icon: BarChart3, soon: true },
  { label: 'Staff', href: '/staff', icon: UserCog, permission: Permission.STAFF_MANAGE, soon: true },
  { label: 'Settings', href: '/settings', icon: Settings, permission: Permission.MESS_VIEW },
];

export function navForRole(role: Role) {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}
