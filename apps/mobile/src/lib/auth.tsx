import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { AuthContext, AuthResponse, RegisterOwnerRequest, RequestOtpResponse } from '@mess/shared';
import { api, logoutRequest, onSessionExpired, refreshSession, setStudentMessId, storeSession } from './api';
import { unregisterPush } from './push';
import { useToast } from '@/components/toast';

type Status = 'loading' | 'authenticated' | 'guest';

interface AuthState {
  status: Status;
  session: AuthContext | null;
  restoreError: boolean;
  retryRestore(): void;
  requestOtp(mobile: string): Promise<RequestOtpResponse>;
  verifyOtp(mobile: string, code: string): Promise<void>;
  /** Password sign-in (owner, manager, staff) — the same accounts work on web and mobile. */
  passwordLogin(identifier: string, password: string): Promise<void>;
  /** Owner signup (no mess yet: the owner creates their own new mess during setup). */
  registerOwner(input: RegisterOwnerRequest): Promise<void>;
  logout(): Promise<void>;
  /** Re-reads the session (e.g. after a password change). */
  refreshSession(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

const toContext = ({ user, membership, role, student, billing }: AuthResponse): AuthContext => ({ user, membership, role, student, billing });

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

  const passwordLogin = useCallback(async (identifier: string, password: string) => {
    const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: { identifier, password, rememberMe: true }, auth: false });
    await storeSession(res);
    setSession(toContext(res));
    setStatus('authenticated');
  }, []);

  const registerOwner = useCallback(
    async (input: RegisterOwnerRequest) => {
      await api('/auth/register/owner', { method: 'POST', body: input, auth: false });
      await passwordLogin(input.mobile, input.password);
    },
    [passwordLogin],
  );

  const reloadSession = useCallback(async () => {
    const ctx = await api<AuthContext>('/auth/me');
    setSession(ctx);
  }, []);

  // Back from the background: re-read the context so role/membership/link/suspension changes apply.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') api<AuthContext>('/auth/me').then(setSession).catch(() => undefined);
    });
    return () => sub.remove();
  }, [status]);

  const logout = useCallback(async () => {
    try {
      // Stop push to this phone for this user while we still have a valid session.
      await unregisterPush();
      await logoutRequest();
    } finally {
      setStudentMessId(null);
      setSession(null);
      setStatus('guest');
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, session, restoreError, retryRestore: () => setAttempt((n) => n + 1), requestOtp, verifyOtp, passwordLogin, registerOwner, logout, refreshSession: reloadSession }),
    [status, session, restoreError, requestOtp, verifyOtp, passwordLogin, registerOwner, logout, reloadSession],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

