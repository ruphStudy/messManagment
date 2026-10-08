'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { can, Permission, REPORT_INFO, REPORT_PERMISSIONS, ReportType } from '@mess/shared';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';

function ReportsHome() {
  const { session } = useAuth();
  const types = Object.values(ReportType).filter((t) => can(session?.role, REPORT_PERMISSIONS[t]));
  return (
    <>
      <PageHeader title="Reports" description="Filter, review and download your mess records as CSV" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <li key={t}>
            <Link href={`/reports/${t}`} className="flex min-h-24 items-center gap-3 rounded-card border border-border bg-surface p-4 hover:border-brand-300 hover:bg-brand-50">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{REPORT_INFO[t].title}</p>
                <p className="text-sm text-ink-muted">{REPORT_INFO[t].description}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function ReportsPage() {
  return (
    <RequireAuth permission={Permission.REPORTS_VIEW}>
      <ReportsHome />
    </RequireAuth>
  );
}
