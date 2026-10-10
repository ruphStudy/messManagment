import {
  Activity,
  Bell,
  Home,
  MessageCircleHeart,
  QrCode,
  UserRound,
  BarChart3,
  Building2,
  ScrollText,
  ServerCog,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  MessageSquareWarning,
  PauseCircle,
  Repeat,
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
  { label: 'Students', href: '/students', icon: Users, permission: Permission.STUDENT_VIEW },
  { label: 'Meal Plans', href: '/meal-plans', icon: ClipboardList, permission: Permission.MEAL_PLAN_VIEW },
  { label: 'Subscriptions', href: '/subscriptions', icon: Repeat, permission: Permission.SUBSCRIPTION_VIEW },
  { label: 'Menu', href: '/menu', icon: UtensilsCrossed, permission: Permission.MENU_VIEW },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck, permission: Permission.ATTENDANCE_VIEW },
  { label: 'Meal Pause', href: '/pauses', icon: PauseCircle, permission: Permission.PAUSE_VIEW },
  { label: 'Payments', href: '/payments', icon: CreditCard, permission: Permission.PAYMENT_VIEW },
  { label: 'Expenses', href: '/expenses', icon: Wallet, permission: Permission.EXPENSE_VIEW },
  { label: 'Feedback', href: '/feedback', icon: MessageSquare, permission: Permission.FEEDBACK_VIEW },
  { label: 'Complaints', href: '/complaints', icon: MessageSquareWarning, permission: Permission.COMPLAINT_VIEW },
  { label: 'Reports', href: '/reports', icon: BarChart3, permission: Permission.REPORTS_VIEW },
  { label: 'Staff', href: '/staff', icon: UserCog, permission: Permission.STAFF_VIEW },
  { label: 'Settings', href: '/settings', icon: Settings, permission: Permission.MESS_VIEW },
];

export function navForRole(role: Role) {
  return NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
}

/** Platform admin portal (/admin). Every item needs PLATFORM_ADMIN_ACCESS, enforced by the admin layout and the API. */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: Activity, permission: Permission.PLATFORM_ADMIN_ACCESS },
  { label: 'Messes', href: '/admin/messes', icon: Building2, permission: Permission.PLATFORM_ADMIN_ACCESS },
  { label: 'Users', href: '/admin/users', icon: Users, permission: Permission.PLATFORM_ADMIN_ACCESS },
  { label: 'Complaints', href: '/admin/complaints', icon: MessageSquareWarning, permission: Permission.PLATFORM_ADMIN_ACCESS },
  { label: 'Activity / Audit', href: '/admin/audit', icon: ScrollText, permission: Permission.PLATFORM_ADMIN_ACCESS },
  { label: 'System', href: '/admin/system', icon: ServerCog, permission: Permission.PLATFORM_ADMIN_ACCESS },
];

/** Student web area (/student). Unlinked students only get Home, Notifications and Profile until their mess adds them. */
const STUDENT_NAV_ITEMS: (NavItem & { linkedOnly?: boolean })[] = [
  { label: 'Home', href: '/student', icon: Home },
  { label: 'Menu', href: '/student/menu', icon: UtensilsCrossed, linkedOnly: true },
  { label: 'Meal QR', href: '/student/qr', icon: QrCode, linkedOnly: true },
  { label: 'Meal plans', href: '/student/plans', icon: ClipboardList, linkedOnly: true },
  { label: 'Pause', href: '/student/pause', icon: PauseCircle, linkedOnly: true },
  { label: 'Payments', href: '/student/payments', icon: Wallet, linkedOnly: true },
  { label: 'Notifications', href: '/student/notifications', icon: Bell },
  { label: 'Feedback', href: '/student/feedback', icon: MessageCircleHeart, linkedOnly: true },
  { label: 'Complaints', href: '/student/complaints', icon: MessageSquareWarning, linkedOnly: true },
  { label: 'Profile', href: '/student/profile', icon: UserRound },
];

export function studentNav(linked: boolean): NavItem[] {
  return STUDENT_NAV_ITEMS.filter((i) => linked || !i.linkedOnly);
}
