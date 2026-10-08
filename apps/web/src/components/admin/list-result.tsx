'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SearchX } from 'lucide-react';
import type { PaginationMeta } from '@mess/shared';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState } from '@/components/ui/states';

interface Props<T> {
  result: { data: T[]; meta: PaginationMeta } | null;
  error: string | null;
  retry: () => void;
  onPage: (page: number) => void;
  /** Shown when filters are active and nothing matches. */
  noMatch: string;
  /** Shown when there is nothing at all. */
  empty: { title: string; icon?: LucideIcon };
  filtered: boolean;
  children: (rows: T[]) => ReactNode;
}

/** Loading skeleton, error with retry, empty/no-match states and pagination around a list. */
export function ListResult<T>({ result, error, retry, onPage, noMatch, empty, filtered, children }: Props<T>) {
  if (error) return <ErrorState title="Couldn't load this list" description={error} onRetry={retry} />;
  if (!result) return <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6" />)}</Card>;
  if (result.data.length === 0) return filtered ? <EmptyState icon={SearchX} title={noMatch} description="Try clearing some filters." /> : <EmptyState icon={empty.icon} title={empty.title} />;
  return (
    <>
      {children(result.data)}
      <Pagination meta={result.meta} onPage={onPage} />
    </>
  );
}
