'use client';

import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import type { AppNotification } from '@mess/shared';
import { useLoadMore } from '@/components/student/paged';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { studentNotificationHref } from '@/lib/student/use-api';
import { useStudentMess } from '@/lib/student/mess-context';

/** Opening a notification marks it read and goes to its student page (if it has one). */
export default function StudentNotificationsPage() {
  const router = useRouter();
  const mess = useStudentMess();
  const { items, setItems, meta, error, loading, load, hasMore } = useLoadMore<AppNotification>('/notifications');
  const open = (n: AppNotification) => {
    if (!n.readAt) {
      setItems((all) => all.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      void api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => undefined);
    }
    const href = studentNotificationHref(n.data);
    // Mess-specific notification from another of my messes: switch to that mess first, then open it.
    const target = n.messId && mess?.memberships.find((m) => m.messId === n.messId);
    if (target && mess?.current?.messId !== n.messId) {
      if (!target.usable && !href) return;
      mess?.select(n.messId!);
    }
    if (href) router.push(href);
  };
  const readAll = async () => {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    setItems((all) => all.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
  };

  return (
    <>
      <PageHeader title="Notifications" actions={items.some((n) => !n.readAt) && <Button variant="secondary" onClick={readAll}>Mark all as read</Button>} />
      {!meta && error ? (
        <ErrorState title="Couldn't load notifications" description={error} onRetry={() => load(1)} />
      ) : !meta ? (
        <Skeleton className="h-40" />
      ) : !items.length ? (
        <EmptyState icon={Bell} title="No notifications yet." />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)} className={cn('flex w-full items-start gap-3 rounded-card border p-4 text-left hover:border-brand-300', n.readAt ? 'border-border bg-surface' : 'border-brand-200 bg-brand-50')} aria-label={`${n.readAt ? '' : 'Unread. '}${n.title}`}>
                <Bell className={cn('mt-0.5 size-5 shrink-0', n.readAt ? 'text-ink-muted' : 'text-brand-600')} aria-hidden />
                <span className="flex-1">
                  <span className={cn('block', !n.readAt && 'font-bold')}>{n.title}</span>
                  <span className="block text-sm text-ink-muted">{n.body}</span>
                  <span className="block text-xs text-ink-muted">{formatDateTime(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="mt-2 size-2 rounded-full bg-brand-600" aria-hidden />}
              </button>
            </li>
          ))}
          {hasMore && <Button variant="secondary" loading={loading} onClick={() => load(meta.page + 1)}>Load more</Button>}
        </ul>
      )}
    </>
  );
}
