'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedValue } from './use-debounce';

/**
 * List filters stored in the URL (so they survive refresh and back navigation), with a debounced `q` search box.
 * Values equal to `defaults` are left out of the URL.
 */
export function useListParams(defaults: Record<string, string> = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = (key: string) => params.get(key) ?? defaults[key] ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const search = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 350);

  const setParams = useCallback(
    (next: Record<string, string | number | null>) => {
      const query = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        const isDefault = value === null || value === '' || (key === 'page' && value === 1) || defaults[key] === String(value);
        if (isDefault) query.delete(key);
        else query.set(key, String(value));
      }
      const qs = query.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are static per page
    [params, pathname, router],
  );

  useEffect(() => {
    if (debouncedSearch !== search) setParams({ q: debouncedSearch, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced input
  }, [debouncedSearch]);

  const clear = (keys: string[]) => {
    setSearchInput('');
    setParams(Object.fromEntries([...keys, 'q', 'page'].map((k) => [k, null])));
  };

  return { get, page, search, searchInput, setSearchInput, setParams, clear };
}
