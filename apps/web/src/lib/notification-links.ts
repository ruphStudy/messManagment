import type { NotificationData } from '@mess/shared';

/** Owner web routes for notification deep links; unknown screens have no link (never a broken one). */
const WEB_ROUTES: Record<string, string> = {
  dues: '/payments/dues',
  payments: '/payments',
  subscriptions: '/subscriptions?view=expiring',
  menu: '/menu',
  pause: '/pauses',
  home: '/dashboard',
};

export function notificationHref(data: NotificationData | null): string | null {
  return (data?.screen && WEB_ROUTES[data.screen]) || null;
}
