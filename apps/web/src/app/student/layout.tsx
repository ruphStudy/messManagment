'use client';

import { useEffect, type ReactNode } from 'react';
import { Role } from '@mess/shared';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';
import { StudentMessGate, StudentMessProvider } from '@/lib/student/mess-context';
import { MessChooser } from '@/components/student/mess-chooser';

const STUDENT_ROLES = [Role.STUDENT];

/** Student web area: student accounts only (others are sent to their own home); the API enforces the same. */
/** Re-read the session once on entry: the mess may have added this mobile since sign-in (the API links it). */
function FreshContext({ children }: { children: ReactNode }) {
  const { reload } = useAuth();
  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);
  return <>{children}</>;
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth roles={STUDENT_ROLES}>
      <FreshContext>
        <StudentMessProvider>
          <AppShell student>
            <StudentMessGate chooser={(m) => <MessChooser memberships={m.memberships} current={m.current} onSelect={m.select} />}>{children}</StudentMessGate>
          </AppShell>
        </StudentMessProvider>
      </FreshContext>
    </RequireAuth>
  );
}
