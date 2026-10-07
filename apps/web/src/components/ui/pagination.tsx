import type { PaginationMeta } from '@mess/shared';
import { Button } from './button';

export function Pagination({ meta, onPage }: { meta: PaginationMeta; onPage: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2">
      <p className="text-sm text-ink-muted">
        {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
