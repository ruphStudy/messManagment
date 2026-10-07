'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Copy, UtensilsCrossed } from 'lucide-react';
import {
  addDays,
  businessToday,
  can,
  isValidDateString,
  MEAL_KEYS,
  menuHasItems,
  MENU_LIMITS,
  Permission,
  type DailyMenu,
  type DailyMenuInput,
  type MenuDay,
  type MessProfile,
} from '@mess/shared';
import { CopyDayDialog } from '@/components/menu/copy-day-dialog';
import { MealEditor } from '@/components/menu/meal-editor';
import { MenuStatusBadge } from '@/components/menu/menu-status-badge';
import { MenuTabs } from '@/components/menu/menu-tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { cleanMenu, emptyMenu, longDate, pickMenuInput } from '@/lib/menu';

const DISCARD_PROMPT = 'You have unsaved menu changes. Discard them?';

function MenuEditorScreen() {
  const { session } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canManage = can(session?.role, Permission.MENU_MANAGE);

  const today = businessToday();
  const requested = params.get('date') ?? '';
  const date = isValidDateString(requested) ? requested : today;

  const [saved, setSaved] = useState<DailyMenu | null>(null);
  const [draft, setDraft] = useState<DailyMenuInput | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [served, setServed] = useState<MessProfile | null>(null);
  const [busy, setBusy] = useState<'save' | 'publish' | 'unpublish' | null>(null);
  const [confirm, setConfirm] = useState<'publish-empty' | 'unpublish' | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const dirty = useMemo(() => {
    if (!draft) return false;
    const base = saved ? cleanMenu(pickMenuInput(saved)) : null;
    return JSON.stringify(cleanMenu(draft)) !== JSON.stringify(base);
  }, [draft, saved]);

  const load = useCallback(() => {
    setLoaded(false);
    setError(null);
    api<MenuDay>(`/menus/${date}`)
      .then(({ menu }) => {
        setSaved(menu);
        setDraft(menu ? pickMenuInput(menu) : null);
        setLoaded(true);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [date]);
  useEffect(load, [load]);

  useEffect(() => {
    api<MessProfile>('/mess').then(setServed).catch(() => setServed(null));
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const goTo = (next: string) => {
    if (next === date || (dirty && !window.confirm(DISCARD_PROMPT))) return;
    router.replace(next === today ? pathname : `${pathname}?date=${next}`, { scroll: false });
  };

  const startNew = () =>
    setDraft(emptyMenu(served ? { breakfast: served.breakfastAvailable, lunch: served.lunchAvailable, dinner: served.dinnerAvailable } : undefined));

  const save = async () => {
    if (!draft) return null;
    const menu = await api<DailyMenu>(`/menus/${date}`, { method: 'PUT', body: cleanMenu(draft) });
    setSaved(menu);
    setDraft(pickMenuInput(menu));
    return menu;
  };

  const run = async (action: 'save' | 'publish' | 'unpublish') => {
    setBusy(action);
    setConfirm(null);
    try {
      if (action === 'save') {
        await save();
        toast.success(saved?.isPublished ? 'Menu updated' : 'Draft saved', longDate(date));
      } else {
        if (action === 'publish' && dirty) await save();
        const menu = await api<DailyMenu>(`/menus/${date}/${action}`, { method: 'POST' });
        setSaved(menu);
        setDraft(pickMenuInput(menu));
        toast.success(action === 'publish' ? 'Menu published' : 'Menu unpublished', action === 'publish' ? 'Students can see it now.' : 'Students can no longer see it.');
      }
    } catch (e) {
      toast.error('Could not save menu', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const publish = () => (draft && !menuHasItems(cleanMenu(draft)) ? setConfirm('publish-empty') : run('publish'));

  const quick = [
    { label: 'Yesterday', value: addDays(today, -1) },
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: addDays(today, 1) },
  ];

  return (
    <div className={cn(draft && canManage && 'pb-24')}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display font-bold tracking-tight">Menu</h1>
          <p className="text-ink-muted">{longDate(date)}</p>
        </div>
        <MenuTabs active="day" date={date} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" aria-label="Previous day" onClick={() => goTo(addDays(date, -1))}><ChevronLeft className="size-4" /></Button>
        {quick.map((q) => (
          <button
            key={q.label}
            onClick={() => goTo(q.value)}
            aria-pressed={date === q.value}
            className={cn(
              'min-h-9 rounded-full border px-4 text-sm font-medium',
              date === q.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-surface hover:bg-canvas',
            )}
          >
            {q.label}
          </button>
        ))}
        <Button variant="secondary" size="sm" aria-label="Next day" onClick={() => goTo(addDays(date, 1))}><ChevronRight className="size-4" /></Button>
        <label className="sr-only" htmlFor="menu-date">Pick a date</label>
        <input
          id="menu-date"
          type="date"
          value={date}
          onChange={(e) => isValidDateString(e.target.value) && goTo(e.target.value)}
          className="h-9 rounded-control border border-border bg-surface px-2 text-sm"
        />
        <span className="ml-auto"><MenuStatusBadge menu={saved} /></span>
      </div>

      {error ? (
        <ErrorState title="Couldn't load the menu" description={error} onRetry={load} />
      ) : !loaded ? (
        <div className="grid gap-4 lg:grid-cols-3" aria-busy>
          {MEAL_KEYS.map((k) => <Card key={k}><Skeleton className="mb-4 h-6 w-28" /><Skeleton className="mb-2 h-11" /><Skeleton className="h-11" /></Card>)}
        </div>
      ) : !draft ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No menu created for this day."
          description={canManage ? 'Create it now, or copy a previous day and adjust.' : 'The mess owner has not added a menu yet.'}
          action={
            canManage && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={startNew}>Create menu</Button>
                <Button variant="secondary" onClick={() => setCopyOpen(true)}><Copy className="size-4" aria-hidden /> Copy from another day</Button>
              </div>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {MEAL_KEYS.map((key) => (
              <MealEditor
                key={key}
                mealKey={key}
                meal={draft[key]}
                readOnly={!canManage}
                onChange={(meal) => setDraft((d) => d && { ...d, [key]: meal })}
              />
            ))}
          </div>
          {canManage ? (
            <Card>
              <Textarea
                id="generalNote"
                label="Note for students (optional)"
                placeholder="e.g. Sunday special · Mess closes early today"
                rows={2}
                maxLength={MENU_LIMITS.generalNoteLength}
                value={draft.generalNote ?? ''}
                onChange={(e) => setDraft((d) => d && { ...d, generalNote: e.target.value })}
              />
            </Card>
          ) : (
            draft.generalNote && <Card><p className="text-sm text-ink-muted">Note</p><p>{draft.generalNote}</p></Card>
          )}
          {canManage && (
            <Button variant="ghost" className="self-start" onClick={() => setCopyOpen(true)}>
              <Copy className="size-4" aria-hidden /> Copy from another day
            </Button>
          )}
        </div>
      )}

      {draft && canManage && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2 sm:px-2">
            <p className="mr-auto text-sm text-ink-muted">
              {dirty ? 'Unsaved changes' : saved?.isPublished ? 'Students can see this menu' : 'Draft — students cannot see it yet'}
            </p>
            {saved?.isPublished ? (
              <>
                <Button variant="ghost" onClick={() => setConfirm('unpublish')} disabled={!!busy}>Unpublish</Button>
                <Button onClick={() => run('save')} disabled={!dirty} loading={busy === 'save'}>Save changes</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => run('save')} disabled={!dirty} loading={busy === 'save'}>Save draft</Button>
                <Button onClick={publish} loading={busy === 'publish'} disabled={!!busy}>{dirty ? 'Save & publish' : 'Publish'}</Button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'publish-empty'}
        title="Publish an empty menu?"
        description="No dishes are listed for any meal that is being served. Students will see an empty menu."
        confirmLabel="Publish anyway"
        onConfirm={() => run('publish')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'unpublish'}
        title="Unpublish this menu?"
        description="Students will no longer see it. The menu is kept as a draft."
        confirmLabel="Unpublish"
        tone="danger"
        loading={busy === 'unpublish'}
        onConfirm={() => run('unpublish')}
        onCancel={() => setConfirm(null)}
      />
      <CopyDayDialog
        open={copyOpen}
        date={date}
        hasMenu={!!saved}
        onClose={() => setCopyOpen(false)}
        onCopied={(menu) => {
          setCopyOpen(false);
          setSaved(menu);
          setDraft(pickMenuInput(menu));
        }}
      />
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense>
      <MenuEditorScreen />
    </Suspense>
  );
}
