import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { can, type PaginationMeta, type Permission } from '@mess/shared';
import { api, apiEnvelope, errorMessage } from './api';
import { useAuth } from './auth';

/** One API resource for team screens (same endpoints as the web app). */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);
  return { data, setData, error, loading, reload };
}

/** Paginated list with "Load more"; `path` may already contain a query string. */
export function useLoadMore<T>(path: string, pageSize = 20) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiEnvelope<T[]>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=${pageSize}`);
        setItems((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
        setMeta(res.meta ?? null);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [path, pageSize],
  );
  useEffect(() => {
    void load(1);
  }, [load]);
  return { items, setItems, meta, error, loading, load, hasMore: !!meta && meta.page < meta.totalPages };
}

/** UI-only permission check from the shared role map; the API enforces the same rules. */
export function useCan() {
  const { session } = useAuth();
  return (permission: Permission) => can(session?.role, permission);
}

/** Native confirmation for important actions. */
export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void, destructive = false) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Runs a mutation and reports the outcome; never shows success when the API refused. */
export async function mutate<T>(run: () => Promise<T>, toast: { show(msg: string, tone?: 'success' | 'error' | 'info'): void }, success?: string): Promise<T | null> {
  try {
    const result = await run();
    if (success) toast.show(success, 'success');
    return result;
  } catch (e) {
    toast.show(errorMessage(e), 'error');
    return null;
  }
}

export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
