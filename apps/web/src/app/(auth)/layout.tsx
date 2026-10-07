import type { ReactNode } from 'react';
import { Logo } from '@/components/brand';
import { GuestOnly } from '@/lib/auth/guards';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <GuestOnly>
      <main className="flex min-h-dvh flex-col items-center px-4 py-8 sm:justify-center">
        <div className="mb-6">
          <Logo />
        </div>
        <div className="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-sm sm:p-8">{children}</div>
      </main>
    </GuestOnly>
  );
}
