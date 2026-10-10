'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { NotLinkedCard } from './student-ui';

/** Mess features need a linked student record; until then show the waiting state with "Check again". */
export function LinkedOnly({ children }: { children: ReactNode }) {
  const { session, reload } = useAuth();
  const [checking, setChecking] = useState(false);
  if (!session) return null;
  if (session.student?.linked) return <>{children}</>;
  return (
    <NotLinkedCard
      mobile={session.user.mobile}
      action={
        <Button variant="secondary" loading={checking} onClick={async () => { setChecking(true); await reload().catch(() => undefined); setChecking(false); }}>
          Check again
        </Button>
      }
    />
  );
}
