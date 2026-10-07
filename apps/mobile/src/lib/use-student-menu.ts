import { useCallback, useEffect, useState } from 'react';
import type { StudentMenuRange, StudentMenuResponse } from '@mess/shared';
import { api, errorMessage } from './api';

/** Published menu of the student's own mess for today / tomorrow / the next 7 days. */
export function useStudentMenu(range: StudentMenuRange) {
  const [data, setData] = useState<StudentMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<StudentMenuResponse>(`/students/me/menu/${range}`));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [range]);

  // Switching range clears stale data so a "week" view never renders today's single day.
  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

const dayFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "Thursday, 8 Oct" */
export const menuDayLabel = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));
