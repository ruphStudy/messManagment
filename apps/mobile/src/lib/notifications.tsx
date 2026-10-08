import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { router, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type { NotificationData } from '@mess/shared';
import { api } from './api';
import { registerForPush } from './push';

/** Deep-link targets that exist in this app; anything else simply opens nothing (never a broken route). */
const ROUTES: Record<string, Href> = { home: '/', payments: '/payments', menu: '/menu', pause: '/pause', plans: '/plans' };

export function openNotificationTarget(data: NotificationData | null | undefined) {
  const route = data?.screen && ROUTES[data.screen];
  if (route) router.push(route);
}

interface NotificationsState {
  unread: number;
  refresh(): Promise<void>;
  markRead(id: string): Promise<void>;
}

const Ctx = createContext<NotificationsState | null>(null);

/** Unread badge + push wiring for the signed-in student. Polls only on focus/foreground and when a push arrives. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setUnread((await api<{ count: number }>('/notifications/unread-count')).count);
    } catch {
      // Badge is best effort.
    }
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      await api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
      void refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
    void registerForPush();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    const received = Notifications.addNotificationReceivedListener(() => void refresh());
    // Tapping a push: mark it read and open its screen.
    const handleTap = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData & { notificationId?: string };
      if (typeof data?.notificationId === 'string') void markRead(data.notificationId);
      openNotificationTarget(data);
    };
    const tapped = Notifications.addNotificationResponseReceivedListener(handleTap);
    void Notifications.getLastNotificationResponseAsync().then((r) => r && handleTap(r));
    return () => {
      appState.remove();
      received.remove();
      tapped.remove();
    };
  }, [refresh, markRead]);

  const value = useMemo(() => ({ unread, refresh, markRead }), [unread, refresh, markRead]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
