'use client';

import { ShieldAlert } from 'lucide-react';
import { Role } from '@mess/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';

function NoAccess() {
  const { session, logout } = useAuth();
  const description =
    session?.role === Role.STUDENT
      ? 'Open your student home to see your mess details.'
      : 'Your account is not linked to a mess yet. Ask your mess owner to add you.';

  return (
    <div className="grid min-h-dvh place-items-center">
      <EmptyState
        icon={ShieldAlert}
        title="Nothing to show here"
        description={description}
        action={
          <Button variant="secondary" onClick={() => void logout()}>
            Sign out
          </Button>
        }
      />
    </div>
  );
}

export default function NoAccessPage() {
  return (
    <RequireAuth>
      <NoAccess />
    </RequireAuth>
  );
}
