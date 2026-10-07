'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { can, type Permission, type Role } from '@mess/shared';
import { PageLoader } from '@/components/ui/loader';
import { ErrorState } from '@/components/ui/states';
import { useAuth } from './auth-context';
import { homePath } from './permissions';

function RestoreGate({ children }: { children: ReactNode }) {
  const { status, restoreError, retryRestore } = useAuth();
  if (restoreError) {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <ErrorState
          title="Can't connect right now"
          description="We couldn't reach the server. Check your internet connection."
          onRetry={retryRestore}
        />
      </div>
    );
  }
  if (status === 'loading') return <PageLoader />;
  return <>{children}</>;
}

interface RequireAuthProps {
  children: ReactNode;
  roles?: readonly Role[];
  permission?: Permission;
  /** Require an active mess membership; owners without one are sent to onboarding. */
  requireMess?: boolean;
}

/** Client-side route guard. The API enforces the same rules; this only keeps users out of screens they can't use. */
export function RequireAuth({ children, roles, permission, requireMess = false }: RequireAuthProps) {
  const { status, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowed =
    !!session &&
    (!roles || roles.includes(session.role)) &&
    (!permission || can(session.role, permission)) &&
    (!requireMess || !!session.membership);

  useEffect(() => {
    if (status === 'guest') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (status === 'authenticated' && session && !allowed) router.replace(homePath(session));
  }, [status, session, allowed, router, pathname]);

  return <RestoreGate>{allowed ? children : <PageLoader />}</RestoreGate>;
}

/** For login/register: signed-in users are sent to their home screen. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session) router.replace(homePath(session));
  }, [status, session, router]);

  return <RestoreGate>{status === 'guest' ? children : <PageLoader />}</RestoreGate>;
}
