'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Copy, CopyPlus, Pencil } from 'lucide-react';
import {
  addDays,
  businessToday,
  can,
  isValidDateString,
  MEAL_KEYS,
  MEAL_LABELS,
  Permission,
  startOfWeek,
  type CopyWeekResult,
  type MenuDay,
} from '@mess/shared';
import { CopyDayDialog } from '@/components/menu/copy-day-dialog';
import { MenuStatusBadge } from '@/components/menu/menu-status-badge';
import { MenuTabs } from '@/components/menu/menu-tabs';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/choice';
import { Skeleton } from '@/components/ui/loader';
import { Modal } from '@/components/ui/modal';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { mealSummary, shortDate } from '@/lib/menu';

const linkButton = 'inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-sm font-semibold';

function WeekScreen() {
  const { session } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canManage = can(session?.role, Permission.MENU_MANAGE);

  const today = businessToday();
  const requested = params.get('week') ?? '';
  const week = startOfWeek(isValidDateString(requested) ? requested : today);
  const end = addDays(week, 6);

  const [days, setDays] = useState<MenuDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyDay, setCopyDay] = useState<MenuDay | null>(null);
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const [replace, setReplace] = useState(false);
  const [copyingWeek, setCopyingWeek] = useState(false);
  const [weekResult, setWeekResult] = useState<CopyWeekResult | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<MenuDay[]>(`/menus?from=${week}&to=${end}`)
      .then(setDays)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [week, end]);
  useEffect(load, [load]);

  const goWeek = (start: string) => {
    setWeekResult(null);
    router.replace(start === startOfWeek(today) ? pathname : `${pathname}?week=${start}`, { scroll: false });
  };

  const copyWeek = async () => {
    setCopyingWeek(true);
    try {
      const result = await api<CopyWeekResult>('/menus/copy-week', { method: 'POST', body: { weekStart: week, replace } });
      setWeekResult(result);
      setCopyWeekOpen(false);
      toast.success(`${result.copied.length} ${result.copied.length === 1 ? 'day' : 'days'} copied as drafts`);
      load();
    } catch (e) {
      toast.error('Could not copy week', errorMessage(e));
    } finally {
      setCopyingWeek(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display font-bold tracking-tight">Weekly menu</h1>
          <p className="text-ink-muted">{shortDate(week)} – {shortDate(end)}</p>
        </div>
        <MenuTabs active="week" date={week} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" aria-label="Previous week" onClick={() => goWeek(addDays(week, -7))}><ChevronLeft className="size-4" /></Button>
        <Button variant="secondary" size="sm" onClick={() => goWeek(startOfWeek(today))} disabled={week === startOfWeek(today)}>This week</Button>
        <Button variant="secondary" size="sm" aria-label="Next week" onClick={() => goWeek(addDays(week, 7))}><ChevronRight className="size-4" /></Button>
        {canManage && (
          <Button variant="secondary" size="sm" className="sm:ml-auto" onClick={() => { setReplace(false); setCopyWeekOpen(true); }}>
            <CopyPlus className="size-4" aria-hidden /> Copy previous week
          </Button>
        )}
      </div>

      {weekResult && (
        <Alert tone="success" className="mb-4">
          Copied {weekResult.copied.length} {weekResult.copied.length === 1 ? 'day' : 'days'} as drafts.
          {weekResult.skipped.length > 0 && (
            <> Skipped: {weekResult.skipped.map((s) => `${shortDate(s.date)} (${s.reason.toLowerCase()})`).join(', ')}.</>
          )}
          {weekResult.failed.length > 0 && <> Failed: {weekResult.failed.map((f) => shortDate(f.date)).join(', ')}.</>}
        </Alert>
      )}

      {error ? (
        <ErrorState title="Couldn't load this week" description={error} onRetry={load} />
      ) : !days ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy>
          {Array.from({ length: 7 }, (_, i) => <Card key={i}><Skeleton className="mb-3 h-5 w-32" /><Skeleton className="h-16" /></Card>)}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => (
            <li key={day.date}>
              <Card className={cn('flex h-full flex-col gap-3 p-4 sm:p-5', day.date === today && 'border-brand-500')}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{shortDate(day.date)}</h2>
                    {day.date === today && <Badge tone="brand">Today</Badge>}
                  </div>
                  <MenuStatusBadge menu={day.menu} />
                </div>

                {day.menu ? (
                  <dl className="flex flex-col gap-1.5 text-sm">
                    {MEAL_KEYS.map((key) => (
                      <div key={key} className="grid grid-cols-[5.5rem_1fr] gap-2">
                        <dt className="text-ink-muted">{MEAL_LABELS[key]}</dt>
                        <dd className={cn('line-clamp-2', !day.menu![key].available && 'italic text-ink-muted')}>{mealSummary(day.menu![key])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-ink-muted">No menu created for this day.</p>
                )}

                <div className="mt-auto flex flex-wrap gap-1 border-t border-border pt-2">
                  <Link href={`/menu?date=${day.date}`} className={`${linkButton} text-brand-700 hover:bg-brand-50`}>
                    <Pencil className="size-4" aria-hidden /> {canManage ? (day.menu ? 'Edit' : 'Create') : 'View'}
                  </Link>
                  {canManage && (
                    <button onClick={() => setCopyDay(day)} className={`${linkButton} text-ink-muted hover:bg-canvas`}>
                      <Copy className="size-4" aria-hidden /> Copy previous day
                    </button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={copyWeekOpen}
        onClose={() => setCopyWeekOpen(false)}
        title="Copy previous week?"
        description={`${shortDate(addDays(week, -7))} – ${shortDate(addDays(week, -1))} → ${shortDate(week)} – ${shortDate(end)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopyWeekOpen(false)} disabled={copyingWeek}>Cancel</Button>
            <Button variant={replace ? 'danger' : 'primary'} onClick={copyWeek} loading={copyingWeek}>Copy week</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Each day is copied to the same weekday as a draft. Nothing is published automatically.</p>
        <Checkbox
          id="replace"
          className="mt-3"
          label="Replace days that already have a menu"
          description={replace ? 'Existing menus this week will be overwritten.' : 'Days that already have a menu are skipped.'}
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
        />
      </Modal>

      {copyDay && (
        <CopyDayDialog
          open
          date={copyDay.date}
          hasMenu={!!copyDay.menu}
          onClose={() => setCopyDay(null)}
          onCopied={() => {
            setCopyDay(null);
            load();
          }}
        />
      )}
    </>
  );
}

export default function WeeklyMenuPage() {
  return (
    <Suspense>
      <WeekScreen />
    </Suspense>
  );
}
