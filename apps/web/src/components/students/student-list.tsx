'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { StudentListItem } from '@mess/shared';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { formatDate, formatMobile, fullName } from '@/lib/format';
import { AppLinkBadge, StudentStatusBadge } from './student-badges';
import { PersonName } from '@/components/ui/avatar';

const studyLine = (s: StudentListItem) => [s.collegeName, s.hostelOrPg].filter(Boolean).join(' · ');

/** Table on md+ screens, tappable cards on phones. */
export function StudentList({ students }: { students: StudentListItem[] }) {
  const router = useRouter();
  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-border bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Student</th>
              <th scope="col" className="px-4 py-3 font-medium">Mobile</th>
              <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">College / PG</th>
              <th scope="col" className="px-4 py-3 font-medium">Joined</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">App</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((s) => (
              <tr key={s.id} onClick={() => router.push(`/students/${s.id}`)} className="cursor-pointer hover:bg-canvas">
                <td className="px-4 py-3 font-semibold"><PersonName name={fullName(s)} /></td>
                <td className="whitespace-nowrap px-4 py-3">{formatMobile(s.mobile)}</td>
                <td className="hidden max-w-56 truncate px-4 py-3 text-ink-muted lg:table-cell">{studyLine(s) || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatDate(s.joiningDate)}</td>
                <td className="px-4 py-3"><StudentStatusBadge status={s.status} /></td>
                <td className="px-4 py-3"><AppLinkBadge linked={s.appLinked} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/students/${s.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center font-medium text-brand-700 hover:underline">
                    View <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {students.map((s) => (
          <li key={s.id}>
            <Link href={`/students/${s.id}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 active:bg-canvas">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <PersonName name={fullName(s)} className="font-semibold" />
                  <StudentStatusBadge status={s.status} />
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{formatMobile(s.mobile)}</p>
                {studyLine(s) && <p className="truncate text-sm text-ink-muted">{studyLine(s)}</p>}
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                  Joined {formatDate(s.joiningDate)} <AppLinkBadge linked={s.appLinked} />
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function StudentListSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="hidden h-5 w-32 sm:block" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </Card>
  );
}
