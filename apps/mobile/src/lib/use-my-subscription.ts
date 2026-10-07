import { useCallback, useEffect, useState } from 'react';
import type { MySubscriptionResponse } from '@mess/shared';
import { api, errorMessage } from './api';

export function useMySubscription() {
  const [data, setData] = useState<MySubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<MySubscriptionResponse>('/students/me/subscription'));
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
