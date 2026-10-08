'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileSearch, Lock, SearchX, X } from 'lucide-react';
import {
  can,
  daysBetween,
  isValidDateString,
  Permission,
  REPORT_INFO,
  REPORT_LIMITS,
  REPORT_PERMISSIONS,
  ReportType,
  type ApiSuccess,
} from '@mess/shared';
import { ReportTable } from '@/components/reports/report-table';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select, type SelectOption } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api, apiDownload, apiEnvelope, errorMessage, isAbortError } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';
import { datePresets, REPORT_SCREENS, summaryStats } from '@/lib/reports';
import { useListParams } from '@/lib/use-list-params';

const isReportType = (t: string): t is ReportType => (Object.values(ReportType) as string[]).includes(t);

/** Loads options for selects backed by the API (e.g. expense categories). */
function useDynamicOptions(type: ReportType) {
  const [loaded, setLoaded] = useState<Record<string, SelectOption[]>>({});
  useEffect(() => {
    for (const f of REPORT_SCREENS[type].selects) {
      if (!f.optionsFrom) continue;
      const { path, value, label } = f.optionsFrom;
      api<Record<string, string>[]>(path)
        .then((items) => setLoaded((prev) => ({ ...prev, [f.key]: items.map((i) => ({ value: i[value], label: i[label] })) })))
        .catch(() => undefined);
    }
  }, [type]);
  return loaded;
}

function ReportView({ type }: { type: ReportType }) {
  const screen = REPORT_SCREENS[type];
  const dates = screen.dates;
  const presets = useMemo(() => datePresets(), []);
  const thisMonth = presets[3];
  const list = useListParams(dates?.required ? { [dates.from]: thisMonth.from, [dates.to]: thisMonth.to } : {});
  const from = dates && isValidDateString(list.get(dates.from)) ? list.get(dates.from) : '';
  const to = dates && isValidDateString(list.get(dates.to)) ? list.get(dates.to) : '';
  const [customOpen, setCustomOpen] = useState(false);
  const activePreset = presets.find((p) => p.from === from && p.to === to);
  const showCustom = !!dates && (customOpen || (!activePreset && !!(from || to)));
  const dynamicOptions = useDynamicOptions(type);

  const rangeError = (() => {
    if (!dates) return null;
    if (dates.required && (!from || !to)) return 'Choose both dates.';
    if (!from || !to) return null;
    const span = daysBetween(from, to) + 1;
    if (span < 1) return '"To" must be on or after "From".';
    if (span > REPORT_LIMITS.maxRangeDays) return `Choose at most ${REPORT_LIMITS.maxRangeDays} days.`;
    return null;
  })();

  // Same filters for the table and the CSV export.
  const filterQuery = (() => {
    const q = new URLSearchParams();
    if (dates && from) q.set(dates.from, from);
    if (dates && to) q.set(dates.to, to);
    for (const f of screen.selects) if (list.get(f.key)) q.set(f.key, list.get(f.key));
    if (list.search) q.set('search', list.search);
    return q.toString();
  })();

  const [result, setResult] = useState<ApiSuccess<unknown[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (rangeError) return;
    const controller = new AbortController();
    const q = new URLSearchParams(filterQuery);
    q.set('page', String(list.page));
    q.set('pageSize', '25');
    setError(null);
    setResult(null);
    apiEnvelope<unknown[]>(`/reports/${type}?${q}`, { signal: controller.signal })
      .then(setResult)
      .catch((e: unknown) => !isAbortError(e) && setError(errorMessage(e)));
    return () => controller.abort();
  }, [type, filterQuery, list.page, rangeError, attempt]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await apiDownload(`/reports/${type}/export?${filterQuery}`, `${type}.csv`);
    } catch (e) {
      setExportError(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const filterKeys = [...(dates && !dates.required ? [dates.from, dates.to] : []), ...screen.selects.map((f) => f.key)];
  const hasFilters = !!list.search || filterKeys.some((k) => list.get(k));
  const stats = result ? summaryStats(type, result.summary) : null;
  const total = result?.meta?.total;

  return (
    <>
      <Link href="/reports" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> All reports
      </Link>
      <PageHeader
        title={`${REPORT_INFO[type].title} report`}
        description={REPORT_INFO[type].description}
        actions={
          <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={!!rangeError || !total}>
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
        }
      />
      {exportError && <Alert tone="danger" className="mb-4">{exportError}</Alert>}

      {dates && (
        <div className="mb-3">
          <p className="mb-1.5 text-sm font-medium">{dates.label}</p>
          <div className="flex flex-wrap gap-2">
            {!dates.required && (
              <Button size="sm" variant={!from && !to && !customOpen ? 'primary' : 'secondary'} onClick={() => { setCustomOpen(false); list.setParams({ [dates.from]: null, [dates.to]: null, page: 1 }); }}>
                Any time
              </Button>
            )}
            {presets.map((p) => (
              <Button key={p.label} size="sm" variant={activePreset === p && !customOpen ? 'primary' : 'secondary'} onClick={() => { setCustomOpen(false); list.setParams({ [dates.from]: p.from, [dates.to]: p.to, page: 1 }); }}>
                {p.label}
              </Button>
            ))}
            <Button size="sm" variant={showCustom ? 'primary' : 'secondary'} onClick={() => setCustomOpen(true)}>Custom</Button>
          </div>
          {showCustom && (
            <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
              {([['From', dates.from, from], ['To', dates.to, to]] as const).map(([label, key, value]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label htmlFor={key} className="text-sm font-medium">{label}</label>
                  <input id={key} type="date" value={value} onChange={(e) => list.setParams({ [key]: e.target.value || null, page: 1 })} className="h-11 rounded-control border border-border bg-surface px-3" />
                </div>
              ))}
            </div>
          )}
          {rangeError && <p role="alert" className="mt-2 text-sm text-danger">{rangeError}</p>}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        {screen.searchPlaceholder && (
          <SearchInput label="Search" value={list.searchInput} onChange={list.setSearchInput} placeholder={screen.searchPlaceholder} />
        )}
        {screen.selects.map((f) => (
          <Select
            key={f.key}
            id={`f-${f.key}`}
            label={f.label}
            options={[...f.options, ...(dynamicOptions[f.key] ?? [])]}
            value={list.get(f.key)}
            onChange={(e) => list.setParams({ [f.key]: e.target.value, page: 1 })}
          />
        ))}
      </div>
      {hasFilters && (
        <button onClick={() => { setCustomOpen(false); list.clear(filterKeys); }} className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}

      {rangeError ? null : error ? (
        <ErrorState title="Couldn't load this report" description={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !result ? (
        <Card className="flex flex-col gap-3 p-4" aria-busy>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6" />)}</Card>
      ) : (
        <>
          <Card className="mb-4">
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <dt className="text-sm text-ink-muted">Rows</dt>
                <dd className="text-2xl font-bold">{total}</dd>
              </div>
              {stats?.map(([label, value, note]) => (
                <div key={label}>
                  <dt className="text-sm text-ink-muted">{label}{note && <span className="text-xs"> ({note})</span>}</dt>
                  <dd className="text-2xl font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {result.data.length === 0 ? (
            <EmptyState icon={hasFilters ? SearchX : FileSearch} title={screen.emptyText} description={hasFilters ? 'Try clearing some filters.' : undefined} />
          ) : (
            <>
              <ReportTable type={type} rows={result.data} />
              <Pagination meta={result.meta!} onPage={(p) => list.setParams({ page: p })} />
            </>
          )}
        </>
      )}
    </>
  );
}

function ReportScreen() {
  const { type } = useParams<{ type: string }>();
  const { session } = useAuth();
  if (!isReportType(type)) return <EmptyState icon={FileSearch} title="Report not found" action={<Link href="/reports" className="font-semibold text-brand-700 hover:underline">See all reports</Link>} />;
  if (!can(session?.role, REPORT_PERMISSIONS[type])) return <EmptyState icon={Lock} title="You don't have access to this report." action={<Link href="/reports" className="font-semibold text-brand-700 hover:underline">See your reports</Link>} />;
  return <ReportView key={type} type={type} />;
}

export default function ReportPage() {
  return (
    <RequireAuth permission={Permission.REPORTS_VIEW}>
      <Suspense><ReportScreen /></Suspense>
    </RequireAuth>
  );
}
