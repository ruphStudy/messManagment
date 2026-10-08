'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, Settings, X } from 'lucide-react';
import { ROLE_LABELS } from '@mess/shared';
import { Logo } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/modal';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { navForRole } from '@/lib/navigation';
import { NotificationBell } from '@/components/notifications/notification-bell';

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth();
  const pathname = usePathname();
  if (!session) return null;

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 p-3">
      {navForRole(session.role).map(({ label, href, icon: Icon, soon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const content = (
          <>
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {soon && <Badge>Soon</Badge>}
          </>
        );
        const base = 'flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium';
        return soon ? (
          <span key={href} aria-disabled className={cn(base, 'cursor-not-allowed text-slate-400')} title="Coming in a future update">
            {content}
          </span>
        ) : (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(base, active ? 'bg-brand-50 text-brand-700' : 'text-ink hover:bg-canvas')}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({ onLogout }: { onLogout: () => void }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!session) return null;
  const { user, role } = session;
  const initials = `${user.firstName[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-11 items-center gap-2 rounded-control px-2 hover:bg-canvas"
      >
        <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{initials}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight">{user.firstName}</span>
          <span className="block text-xs text-ink-muted">{ROLE_LABELS[role]}</span>
        </span>
        <ChevronDown className="size-4 text-ink-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-60 rounded-card border border-border bg-surface p-2 shadow-lg">
          <div className="border-b border-border px-3 pb-2 pt-1">
            <p className="text-sm font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-ink-muted">{user.email ?? user.mobile}</p>
          </div>
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center gap-2 rounded-control px-3 text-sm hover:bg-canvas"
          >
            <Settings className="size-4" aria-hidden /> Mess settings
          </Link>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-sm text-danger hover:bg-danger-soft"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Authenticated owner/staff layout: sidebar on desktop, slide-in drawer on small screens. */
export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  const doLogout = async () => {
    setLoggingOut(true);
    await logout().catch(() => undefined);
    router.replace('/login');
  };

  return (
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-surface lg:flex print:hidden">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-xl">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button onClick={() => setDrawerOpen(false)} className="rounded-full p-2 hover:bg-canvas" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 print:hidden">
        <button onClick={() => setDrawerOpen(true)} className="-ml-2 rounded-full p-2 hover:bg-canvas lg:hidden" aria-label="Open menu">
          <Menu className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{session?.membership?.mess.name}</p>
        </div>
        <NotificationBell />
        <UserMenu onLogout={() => setConfirmLogout(true)} />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">{children}</main>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        description="You will need to sign in again to manage your mess."
        confirmLabel="Sign out"
        tone="danger"
        loading={loggingOut}
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
