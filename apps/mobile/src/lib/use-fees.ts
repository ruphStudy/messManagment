import { useCallback, useEffect, useState } from 'react';
import type { StudentFeesResponse } from '@mess/shared';
import { api, errorMessage } from './api';

/** Fee / paid / due for the student's current, upcoming and still-owing subscriptions. */
export function useFees() {
  const [data, setData] = useState<StudentFeesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<StudentFeesResponse>('/students/me/fees'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, loading, error, reload };
}
