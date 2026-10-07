import type { ReactNode } from 'react';
import { WEB_ROLES } from '@mess/shared';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/lib/auth/guards';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth roles={WEB_ROLES} requireMess>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
