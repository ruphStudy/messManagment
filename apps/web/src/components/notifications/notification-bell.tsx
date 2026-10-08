'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';

const POLL_MS = 60_000;

/** Header bell with unread count. Polls gently and refreshes on navigation; no websockets. */
export function NotificationBell() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    api<{ count: number }>('/notifications/unread-count').then((r) => setCount(r.count)).catch(() => undefined);
  }, []);
  useEffect(load, [load, pathname]);
  useEffect(() => {
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Link href="/notifications" className="relative grid size-11 place-items-center rounded-full hover:bg-canvas" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}>
      <Bell className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold leading-5 text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
