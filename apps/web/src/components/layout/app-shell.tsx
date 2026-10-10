'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, Settings, X } from 'lucide-react';
import { can, Permission, ROLE_LABELS } from '@mess/shared';
import { Logo } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/modal';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/cn';
import { ADMIN_NAV_ITEMS, navForRole, studentNav } from '@/lib/navigation';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Alert } from '@/components/ui/alert';
import { ThemeSelector } from '@/components/ui/theme-selector';
import { useStudentMess } from '@/lib/student/mess-context';

type Area = 'mess' | 'admin' | 'student';
const AREA_ROOT: Record<Area, string> = { mess: '/dashboard', admin: '/admin', student: '/student' };

function SidebarNav({ area, onNavigate }: { area: Area; onNavigate?: () => void }) {
  const { session } = useAuth();
  const pathname = usePathname();
  if (!session) return null;

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 p-3">
      {(area === 'admin' ? ADMIN_NAV_ITEMS : area === 'student' ? studentNav(!!session.student?.linked) : navForRole(session.role)).map(({ label, href, icon: Icon, soon }) => {
        // The area root ("/admin", "/student") is a prefix of every page in it, so it only matches exactly.
        const active = pathname === href || (href !== AREA_ROOT[area] && pathname.startsWith(`${href}/`));
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

function UserMenu({ area, onLogout }: { area: Area; onLogout: () => void }) {
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
        <div role="menu" className="absolute right-0 z-30 mt-2 w-72 rounded-card border border-border bg-surface p-2 shadow-lg">
          <div className="border-b border-border px-3 pb-2 pt-1">
            <p className="text-sm font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-ink-muted">{user.email ?? user.mobile}</p>
          </div>
          {area !== 'admin' && (
            <Link
              role="menuitem"
              href={area === 'student' ? '/student/profile' : '/settings'}
              onClick={() => setOpen(false)}
              className="mt-1 flex min-h-11 items-center gap-2 rounded-control px-3 text-sm hover:bg-canvas"
            >
              <Settings className="size-4" aria-hidden /> {area === 'student' ? 'Profile & settings' : 'Settings'}
            </Link>
          )}
          <div className="border-b border-border px-1 py-2">
            <p className="mb-1 px-2 text-xs font-medium text-ink-muted">Theme</p>
            <ThemeSelector compact />
          </div>
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

/**
 * Authenticated layout: sidebar on desktop, slide-in drawer on small screens.
 * `admin` switches to the platform admin portal (its own navigation, no mess items).
 */
export function AppShell({ children, admin = false, student = false }: { children: ReactNode; admin?: boolean; student?: boolean }) {
  const area: Area = admin ? 'admin' : student ? 'student' : 'mess';
  const studentMess = useStudentMess();
  const { session, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  // A temporary password (set by the owner/manager) must be replaced before using the app.
  const mustChange = area === 'mess' && !!session?.user.mustChangePassword;
  useEffect(() => {
    if (mustChange && pathname !== '/settings') router.replace('/settings?tab=account');
  }, [mustChange, pathname, router]);

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
          <SidebarNav area={area} />
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
              <SidebarNav area={area} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 print:hidden">
        <button onClick={() => setDrawerOpen(true)} className="-ml-2 rounded-full p-2 hover:bg-canvas lg:hidden" aria-label="Open menu">
          <Menu className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          {area === 'student' ? (
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate font-semibold">{studentMess?.current?.messName ?? 'MessMate'}</p>
              {studentMess && studentMess.memberships.length > 1 && (
                <button type="button" onClick={studentMess.openChooser} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">Switch mess</button>
              )}
            </div>
          ) : (
            <p className="truncate font-semibold">{area === 'admin' ? 'Platform Admin' : session?.membership?.mess.name}</p>
          )}
        </div>
        {area !== 'admin' && !mustChange && <NotificationBell href={area === 'student' ? '/student/notifications' : '/notifications'} />}
        <UserMenu area={area} onLogout={() => setConfirmLogout(true)} />
      </header>

      <main className={cn('mx-auto px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0', admin ? 'max-w-6xl' : 'max-w-5xl')}>
        {area === 'student' && studentMess?.current?.messStatus === 'SUSPENDED' && (
          <Alert tone="danger" className="mb-6">
            <strong>Mess temporarily unavailable.</strong> You can see your history, but meal QR, pauses, feedback and complaints are paused for now.
          </Alert>
        )}
        {area === 'mess' && session?.membership?.mess.status === 'SUSPENDED' && (
          <Alert tone="danger" className="mb-6">
            <strong>This mess is temporarily unavailable.</strong> The platform team has paused it. You can still view your records, but changes,
            QR scanning and payments are blocked. Please contact support.
          </Alert>
        )}
        {area === 'mess' && session?.billing && !session.billing.accessAllowed && session.membership?.mess.status !== 'SUSPENDED' && (
          <Alert tone="danger" className="mb-6">
            <strong>MessMate subscription {session.billing.status === 'PENDING_PAYMENT' ? 'not activated yet' : 'not active'}.</strong> You can view your records,
            but changes (students, plans, menus, attendance, payments, expenses) are blocked until the subscription is activated or a trial is granted.{' '}
            {can(session.role, Permission.MESS_SETTINGS_UPDATE) ? (
              <Link href="/settings?tab=billing" className="font-semibold underline">View Billing</Link>
            ) : (
              'Please ask the mess owner to contact support.'
            )}
          </Alert>
        )}
        {children}
      </main>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        description={area === 'admin' ? 'You will need to sign in again to use the admin portal.' : area === 'student' ? 'You will need your mobile number and a code to sign in again.' : 'You will need to sign in again to manage your mess.'}
        confirmLabel="Sign out"
        tone="danger"
        loading={loggingOut}
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
