'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { Plus, SearchX, Upload, Users, X } from 'lucide-react';
import { can, Permission, STUDENT_STATUS_LABELS, StudentStatus, type StudentListItem } from '@mess/shared';
import { StudentList, StudentListSkeleton } from '@/components/students/student-list';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-context';
import { useListParams } from '@/lib/use-list-params';
import { usePagedList } from '@/lib/use-paged-list';

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
  const list = useListParams({ sort: DEFAULT_SORT });
  const status = list.get('status');
  const sort = list.get('sort');
  const { page, search } = list;

  const apiQuery = useMemo(() => {
    const [sortBy, sortOrder] = sort.split(':');
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortOrder });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    return query.toString();
  }, [page, search, sort, status]);
  const { result, error, retry } = usePagedList<StudentListItem>(`/students?${apiQuery}`);
  const setParams = list.setParams;

  const canManage = can(session?.role, Permission.STUDENT_MANAGE);
  const canImport = can(session?.role, Permission.STUDENT_IMPORT);
  const hasFilters = !!(search || status);
  const clearFilters = () => list.clear(['status']);

  const actions = (
    <>
      {canImport && (
        <Link href="/students/import" className={`${linkButton} border border-border bg-surface hover:bg-canvas`}>
          <Upload className="size-4" aria-hidden /> Import
        </Link>
      )}
      {canManage && (
        <Link href="/students/new" className={`${linkButton} bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-500`}>
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
        <SearchInput label="Search students" value={list.searchInput} onChange={list.setSearchInput} placeholder="Search name, mobile, college, PG…" />
        <Select id="status" label="Status" className="sm:w-48" options={STATUS_OPTIONS} value={status} onChange={(e) => setParams({ status: e.target.value, page: 1 })} />
        <Select id="sort" label="Sort by" className="sm:w-52" options={SORT_OPTIONS} value={sort} onChange={(e) => setParams({ sort: e.target.value, page: 1 })} />
      </div>
      {hasFilters && (
        <button onClick={clearFilters} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {error ? (
        <ErrorState title="Couldn't load students" description={error} onRetry={retry} />
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
          {meta && <Pagination meta={meta} onPage={(p) => setParams({ page: p })} />}
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
