import { useCallback, useEffect, useState } from 'react';
import type { StudentPauseSettings } from '@mess/shared';
import { api, errorMessage } from './api';

/** Cut-offs, plans by date and today's meal states for the pause screen and Home. */
export function usePauseSettings() {
  const [data, setData] = useState<StudentPauseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<StudentPauseSettings>('/students/me/pause-settings'));
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
