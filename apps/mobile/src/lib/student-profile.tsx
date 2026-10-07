import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StudentMeResponse, StudentSelfProfile, StudentSelfUpdate } from '@mess/shared';
import { api, errorMessage } from './api';

interface StudentProfileState {
  data: StudentMeResponse | null;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
  update(input: StudentSelfUpdate): Promise<void>;
}

const Ctx = createContext<StudentProfileState | null>(null);

/** Loads the signed-in student's mess profile once for all tabs. Linking happens server-side on load. */
export function StudentProfileProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StudentMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<StudentMeResponse>('/students/me'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback(async (input: StudentSelfUpdate) => {
    const profile = await api<StudentSelfProfile>('/students/me', { method: 'PATCH', body: input });
    setData({ linked: true, profile });
  }, []);

  const value = useMemo(() => ({ data, loading, error, reload, update }), [data, loading, error, reload, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudentProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStudentProfile must be used inside StudentProfileProvider');
  return ctx;
}

export function studentName(profile: Pick<StudentSelfProfile, 'firstName' | 'lastName'>) {
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function formatDate(value: string) {
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}
