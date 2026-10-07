'use client';

import { useEffect, useState } from 'react';
import type { PaginationMeta } from '@mess/shared';
import { apiEnvelope, errorMessage, isAbortError } from './api';

/** Fetches a paginated endpoint whenever `path` changes, cancelling stale requests. */
export function usePagedList<T>(path: string) {
  const [result, setResult] = useState<{ data: T[]; meta: PaginationMeta } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    apiEnvelope<T[]>(path, { signal: controller.signal })
      .then((res) => setResult({ data: res.data, meta: res.meta! }))
      .catch((e: unknown) => !isAbortError(e) && setError(errorMessage(e)));
    return () => controller.abort();
  }, [path, attempt]);

  return { result, error, retry: () => setAttempt((n) => n + 1) };
}
