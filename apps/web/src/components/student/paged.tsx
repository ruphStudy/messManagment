'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaginationMeta } from '@mess/shared';
import { apiEnvelope, errorMessage } from '@/lib/api';

/** "Load more" lists (newest first), like the app's history screens. */
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
