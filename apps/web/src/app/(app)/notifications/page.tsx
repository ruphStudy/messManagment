'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import type { AppNotification, PaginationMeta } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { apiEnvelope, api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { notificationHref } from '@/lib/notification-links';

/** Owner/manager notices (e.g. plans ending soon). Kept minimal on purpose. */
export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    setError(null);
    try {
      const res = await apiEnvelope<AppNotification[]>(`/notifications?page=${page}&pageSize=20`);
      setItems((prev) => (page === 1 ? res.data : [...(prev ?? []), ...res.data]));
      setMeta(res.meta ?? null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const open = async (n: AppNotification) => {
    if (!n.readAt) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
      setItems((all) => all?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
    }
    const href = notificationHref(n.data);
    if (href) router.push(href);
  };

  const readAll = async () => {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    void load();
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={items?.some((n) => !n.readAt) && <Button variant="secondary" onClick={readAll}><CheckCheck className="size-4" aria-hidden /> Mark all read</Button>}
      />
      {error ? <ErrorState description={error} onRetry={() => load()} /> : !items ? <Skeleton className="h-40" /> : items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet." description="Daily notices such as plans ending soon will appear here." />
      ) : (
        <>
          <Card className="divide-y divide-border p-0 sm:p-0">
            {items.map((n) => (
              <button key={n.id} onClick={() => open(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-canvas', !n.readAt && 'bg-brand-50/50')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-600')} aria-label={n.readAt ? undefined : 'Unread'} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block', !n.readAt && 'font-semibold')}>{n.title}</span>
                  <span className="block text-sm text-ink-muted">{n.body}</span>
                  <span className="block text-xs text-ink-muted">{formatDateTime(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </Card>
          {meta && meta.page < meta.totalPages && <Button variant="secondary" className="mt-3" onClick={() => load(meta.page + 1)}>Load more</Button>}
        </>
      )}
    </>
  );
}
