'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, SearchX, Upload, Users, X } from 'lucide-react';
import {
  can,
  Permission,
  STUDENT_STATUS_LABELS,
  StudentStatus,
  type PaginationMeta,
  type StudentListItem,
} from '@mess/shared';
import { StudentList, StudentListSkeleton } from '@/components/students/student-list';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { apiEnvelope, errorMessage, isAbortError } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { useDebouncedValue } from '@/lib/use-debounce';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: '', label: 'Active & inactive' },
  ...Object.values(StudentStatus).map((s) => ({ value: s, label: STUDENT_STATUS_LABELS[s] })),
];
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Recently added' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'joiningDate:desc', label: 'Joining date (newest)' },
  { value: 'joiningDate:asc', label: 'Joining date (oldest)' },
];
const DEFAULT_SORT = SORT_OPTIONS[0].value;

const linkButton = 'inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold';

function StudentsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The URL is the source of truth for filters, so they survive refresh and back navigation.
  const status = params.get('status') ?? '';
  const sort = params.get('sort') ?? DEFAULT_SORT;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const search = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 350);

  const [result, setResult] = useState<{ data: StudentListItem[]; meta: PaginationMeta } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const setParams = (next: Record<string, string | number | null>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '' || (key === 'page' && value === 1) || (key === 'sort' && value === DEFAULT_SORT)) query.delete(key);
      else query.set(key, String(value));
    }
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (debouncedSearch !== search) setParams({ q: debouncedSearch, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced input
  }, [debouncedSearch]);

  const apiQuery = useMemo(() => {
    const [sortBy, sortOrder] = sort.split(':');
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortOrder });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    return query.toString();
  }, [page, search, sort, status]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    apiEnvelope<StudentListItem[]>(`/students?${apiQuery}`, { signal: controller.signal })
      .then((res) => setResult({ data: res.data, meta: res.meta! }))
      .catch((e: unknown) => !isAbortError(e) && setError(errorMessage(e)));
    return () => controller.abort();
  }, [apiQuery, attempt]);

  const canManage = can(session?.role, Permission.STUDENT_MANAGE);
  const canImport = can(session?.role, Permission.STUDENT_IMPORT);
  const hasFilters = !!(search || status);
  const clearFilters = () => {
    setSearchInput('');
    setParams({ q: null, status: null, page: 1 });
  };

  const actions = (
    <>
      {canImport && (
        <Link href="/students/import" className={`${linkButton} border border-border bg-surface hover:bg-canvas`}>
          <Upload className="size-4" aria-hidden /> Import
        </Link>
      )}
      {canManage && (
        <Link href="/students/new" className={`${linkButton} bg-brand-600 text-white hover:bg-brand-700`}>
          <Plus className="size-4" aria-hidden /> Add student
        </Link>
      )}
    </>
  );

  const meta = result?.meta;
  const loading = !result && !error;

  return (
    <>
      <PageHeader title="Students" description={meta ? `${meta.total} ${meta.total === 1 ? 'student' : 'students'}` : undefined} actions={actions} />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="relative">
          <label htmlFor="search" className="sr-only">Search students</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id="search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, mobile, college, PG…"
            className="h-11 w-full rounded-control border border-border bg-surface pl-10 pr-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <Select id="status" label="Status" className="sm:w-48" options={STATUS_OPTIONS} value={status} onChange={(e) => setParams({ status: e.target.value, page: 1 })} />
        <Select id="sort" label="Sort by" className="sm:w-52" options={SORT_OPTIONS} value={sort} onChange={(e) => setParams({ sort: e.target.value, page: 1 })} />
      </div>
      {hasFilters && (
        <button onClick={clearFilters} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {error ? (
        <ErrorState title="Couldn't load students" description={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : loading ? (
        <StudentListSkeleton />
      ) : result!.data.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="No students match your filters."
            description="Try a different search or status."
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No students added yet."
            description="Add students one by one, or import a list from Excel as a CSV file."
            action={<div className="flex flex-wrap justify-center gap-2">{actions}</div>}
          />
        )
      ) : (
        <>
          <StudentList students={result!.data} />
          {meta && meta.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2">
              <p className="text-sm text-ink-muted">
                {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={meta.page <= 1} onClick={() => setParams({ page: meta.page - 1 })}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => setParams({ page: meta.page + 1 })}>
                  Next
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}

export default function StudentsPage() {
  return (
    <Suspense>
      <StudentsScreen />
    </Suspense>
  );
}
