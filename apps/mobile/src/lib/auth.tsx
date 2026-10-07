import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthContext, AuthResponse, RequestOtpResponse } from '@mess/shared';
import { api, logoutRequest, onSessionExpired, refreshSession, storeSession } from './api';
import { useToast } from '@/components/toast';

type Status = 'loading' | 'authenticated' | 'guest';

interface AuthState {
  status: Status;
  session: AuthContext | null;
  restoreError: boolean;
  retryRestore(): void;
  requestOtp(mobile: string): Promise<RequestOtpResponse>;
  verifyOtp(mobile: string, code: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

const toContext = ({ user, membership, role }: AuthResponse): AuthContext => ({ user, membership, role });

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<AuthContext | null>(null);
  const [restoreError, setRestoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Restore the session from the secure refresh token on launch.
  useEffect(() => {
    let cancelled = false;
    setRestoreError(false);
    refreshSession()
      .then((res) => {
        if (cancelled) return;
        setSession(res ? toContext(res) : null);
        setStatus(res ? 'authenticated' : 'guest');
      })
      .catch(() => !cancelled && setRestoreError(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    onSessionExpired(() => {
      setSession(null);
      setStatus('guest');
      toast.show('Your session has ended. Please sign in again.', 'info');
    });
    return () => onSessionExpired(null);
  }, [toast]);

  const requestOtp = useCallback(
    (mobile: string) => api<RequestOtpResponse>('/auth/otp/request', { method: 'POST', body: { mobile }, auth: false }),
    [],
  );

  const verifyOtp = useCallback(async (mobile: string, code: string) => {
    const res = await api<AuthResponse>('/auth/otp/verify', { method: 'POST', body: { mobile, code }, auth: false });
    await storeSession(res);
    setSession(toContext(res));
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setSession(null);
      setStatus('guest');
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, session, restoreError, retryRestore: () => setAttempt((n) => n + 1), requestOtp, verifyOtp, logout }),
    [status, session, restoreError, requestOtp, verifyOtp, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

