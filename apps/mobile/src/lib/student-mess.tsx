import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { pickStudentMess, studentMemberships, type StudentMessMembership } from '@mess/shared';
import { setStudentMessId } from './api';
import { useAuth } from './auth';

const KEY = 'mm.studentMess';

interface StudentMessState {
  current: StudentMessMembership | null;
  memberships: StudentMessMembership[];
  showChooser: boolean;
  /** Returns true if the mess changed (screens reload under it). */
  select(messId: string): boolean;
  openChooser(): void;
}

const Ctx = createContext<StudentMessState | null>(null);

/** Lets non-React code (push taps) switch mess before opening a mess-specific screen. */
let switchMess: ((messId: string) => boolean) | null = null;
export const switchStudentMess = (messId: string) => switchMess?.(messId) ?? false;

/**
 * Student multi-mess context (same rule as web): saved choice if still mine, else the only usable mess,
 * else the student chooses. Saved on this device; sent as x-mess-id; the API verifies membership.
 */
export function StudentMessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const [choosing, setChoosing] = useState(false);
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => setSaved(v ?? null)).catch(() => setSaved(null));
  }, []);

  const ctx = session?.student;
  const { messId, needsChoice } = pickStudentMess(ctx, saved ?? null);
  const memberships = useMemo(() => studentMemberships(ctx), [ctx]);
  const current = memberships.find((m) => m.messId === messId) ?? null;
  setStudentMessId(messId);

  const select = useCallback(
    (id: string) => {
      if (!memberships.some((m) => m.messId === id)) return false;
      void SecureStore.setItemAsync(KEY, id).catch(() => undefined);
      setChoosing(false);
      const changed = id !== messId;
      setSaved(id);
      return changed;
    },
    [memberships, messId],
  );
  useEffect(() => {
    switchMess = select;
    return () => {
      switchMess = null;
    };
  }, [select]);

  const value = useMemo(() => ({ current, memberships, showChooser: needsChoice || choosing, select, openChooser: () => setChoosing(true) }), [current, memberships, needsChoice, choosing, select]);
  if (saved === undefined) return null; // reading the saved choice (instant)
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudentMess() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStudentMess must be used inside StudentMessProvider');
  return ctx;
}
