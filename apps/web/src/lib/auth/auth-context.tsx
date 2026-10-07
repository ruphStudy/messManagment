'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthContext, AuthResponse, LoginRequest } from '@mess/shared';
import { api, onSessionExpired, refreshSession, setAccessToken } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

type Status = 'loading' | 'authenticated' | 'guest';

interface AuthState {
  status: Status;
  session: AuthContext | null;
  /** Set when the app could not reach the server while restoring the session. */
  restoreError: boolean;
  login(input: LoginRequest): Promise<AuthContext>;
  logout(): Promise<void>;
  /** Re-reads the current user and mess membership (e.g. after creating a mess). */
  reload(): Promise<AuthContext>;
  retryRestore(): void;
}

const Ctx = createContext<AuthState | null>(null);

function toContext({ user, membership, role }: AuthResponse | AuthContext): AuthContext {
  return { user, membership, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<AuthContext | null>(null);
  const [restoreError, setRestoreError] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  const clear = useCallback(() => {
    setAccessToken(null);
    setSession(null);
    setStatus('guest');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRestoreError(false);
    refreshSession()
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setSession(toContext(res));
          setStatus('authenticated');
        } else {
          setStatus('guest');
        }
      })
      .catch(() => {
        if (!cancelled) setRestoreError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [restoreAttempt]);

  useEffect(() => {
    onSessionExpired(() => {
      clear();
      toast.show({ tone: 'info', title: 'Your session has ended', description: 'Please sign in again.' });
    });
    return () => onSessionExpired(null);
  }, [clear, toast]);

  const login = useCallback(async (input: LoginRequest) => {
    const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false });
    setAccessToken(res.accessToken);
    const ctx = toContext(res);
    setSession(ctx);
    setStatus('authenticated');
    return ctx;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', auth: false });
    } finally {
      clear();
    }
  }, [clear]);

  const reload = useCallback(async () => {
    const ctx = await api<AuthContext>('/auth/me');
    setSession(ctx);
    return ctx;
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, session, restoreError, login, logout, reload, retryRestore: () => setRestoreAttempt((n) => n + 1) }),
    [status, session, restoreError, login, logout, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
