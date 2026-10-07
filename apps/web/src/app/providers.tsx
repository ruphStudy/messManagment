'use client';

import type { ReactNode } from 'react';
import { ConnectivityBanner } from '@/components/layout/connectivity-banner';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/lib/auth/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ConnectivityBanner />
        {children}
      </AuthProvider>
    </ToastProvider>
  );
}
