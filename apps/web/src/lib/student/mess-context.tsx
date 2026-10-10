'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { pickStudentMess, studentMemberships, type StudentMessMembership } from '@mess/shared';
import { setStudentMessId } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';

const KEY = 'mm.studentMess';
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

interface StudentMessState {
  current: StudentMessMembership | null;
  /** Several usable messes and none chosen yet, or the student opened "Switch mess". */
  showChooser: boolean;
  memberships: StudentMessMembership[];
  /** Switch to another of this student's messes (data reloads under it). */
  select(messId: string): void;
  openChooser(): void;
}

const Ctx = createContext<StudentMessState | null>(null);

/**
 * Student multi-mess context: which of the student's messes the pages use. The choice is kept in this browser and
 * sent as x-mess-id; the API checks the student really belongs to it. One usable mess → chosen automatically;
 * several → the student picks.
 */
export function StudentMessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [saved, setSaved] = useState<string | null>(() => (typeof window === 'undefined' ? null : read()));
  const [choosing, setChoosing] = useState(false);
  const ctx = session?.student;
  const { messId, needsChoice } = pickStudentMess(ctx, saved);
  const memberships = useMemo(() => studentMemberships(ctx), [ctx]);
  const current = memberships.find((m) => m.messId === messId) ?? null;
  // Set before children render so their first requests already carry the right mess.
  setStudentMessId(messId);

  const select = useCallback((id: string) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
    setSaved(id);
    setChoosing(false);
  }, []);
  const showChooser = needsChoice || choosing;
  const value = useMemo(() => ({ current, memberships, showChooser, select, openChooser: () => setChoosing(true) }), [current, memberships, showChooser, select]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Page area: the chooser when needed, else the pages — re-mounted per mess so each reloads its data. */
export function StudentMessGate({ children, chooser }: { children: ReactNode; chooser: (s: StudentMessState) => ReactNode }) {
  const state = useContext(Ctx);
  if (!state) return <>{children}</>;
  if (state.showChooser) return <>{chooser(state)}</>;
  return <MessScope key={state.current?.messId ?? 'none'}>{children}</MessScope>;
}
function MessScope({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Null outside the student area (team/admin shells). */
export function useStudentMess() {
  return useContext(Ctx);
}
