import type { ReactNode } from 'react';
import { Permission, Role } from '@mess/shared';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/lib/auth/guards';

const ADMIN_ROLES = [Role.PLATFORM_ADMIN];

/** Platform admin portal. Other roles are sent to their own home; the API enforces the same rule. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth roles={ADMIN_ROLES} permission={Permission.PLATFORM_ADMIN_ACCESS}>
      <AppShell admin>{children}</AppShell>
    </RequireAuth>
  );
}
