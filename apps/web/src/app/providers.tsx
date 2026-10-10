'use client';

import type { ReactNode } from 'react';
import { ConnectivityBanner } from '@/components/layout/connectivity-banner';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/lib/auth/auth-context';
import { ThemeProvider } from '@/lib/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <ConnectivityBanner />
        {children}
      </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  );
}
