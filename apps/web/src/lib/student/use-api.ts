'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';

/** Loads one student API resource; `reload` refetches. Same endpoints the mobile app uses. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

const dayFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "Thursday, 8 Oct" (date-only values) */
export const dayLabel = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

/** Notification deep links inside the student web area (unknown targets open nothing). */
const ROUTES: Record<string, string> = {
  home: '/student',
  payments: '/student/payments',
  dues: '/student/payments',
  menu: '/student/menu',
  pause: '/student/pause',
  plans: '/student/plans',
  subscriptions: '/student/plans',
};
export function studentNotificationHref(data: Record<string, unknown> | null): string | null {
  if (data?.screen === 'complaint' && typeof data.complaintId === 'string') return `/student/complaints/${data.complaintId}`;
  return (typeof data?.screen === 'string' && ROUTES[data.screen]) || null;
}
