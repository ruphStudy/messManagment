'use client';

import { use, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone } from 'lucide-react';
import { StudentActions } from '@/components/students/student-actions';
import { AppLinkBadge, StudentStatusBadge } from '@/components/students/student-badges';
import { StudentDetailSkeleton, StudentLoadError } from '@/components/students/student-page-states';
import { Card, CardHeader } from '@/components/ui/card';
import { formatDate, formatDateTime, formatMobile, fullName } from '@/lib/format';
import { useStudent } from '@/lib/use-student';

function Details({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="mt-0.5 break-words font-medium">{value || <span className="font-normal text-slate-400">Not added</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function PhoneLink({ mobile }: { mobile: string | null }) {
  if (!mobile) return null;
  return (
    <a href={`tel:+91${mobile}`} className="text-brand-700 hover:underline">
      {formatMobile(mobile)}
    </a>
  );
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { student, setStudent, error, reload } = useStudent(id);

  return (
    <>
      <Link href="/students" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All students
      </Link>

      {error ? (
        <StudentLoadError error={error} onRetry={reload} />
      ) : !student ? (
        <StudentDetailSkeleton />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-display font-bold tracking-tight">{fullName(student)}</h1>
                <StudentStatusBadge status={student.status} />
              </div>
              <a href={`tel:+91${student.mobile}`} className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-ink-muted hover:text-ink">
                <Phone className="size-4" aria-hidden /> {formatMobile(student.mobile)}
              </a>
            </div>
            <StudentActions student={student} onChange={setStudent} />
          </div>

          <Card>
            <CardHeader title="Student details" />
            <Details
              items={[
                ['Email', student.email],
                ['College', student.collegeName],
                ['Course', student.courseName],
                ['Hostel / PG', student.hostelOrPg],
                ['Joining date', formatDate(student.joiningDate)],
              ]}
            />
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Family & emergency" />
              <Details
                items={[
                  ['Parent', student.parentName],
                  ['Parent mobile', <PhoneLink key="p" mobile={student.parentMobile} />],
                  ['Emergency contact', student.emergencyContactName],
                  ['Emergency mobile', <PhoneLink key="e" mobile={student.emergencyContactMobile} />],
                ]}
              />
            </Card>
            <Card>
              <CardHeader title="Address" />
              <p className="whitespace-pre-line break-words">{student.localAddress || <span className="text-slate-400">Not added</span>}</p>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Mobile app account" action={<AppLinkBadge linked={student.appAccount.linked} />} />
              <p className="text-sm text-ink-muted">
                {student.appAccount.linked
                  ? student.appAccount.lastLoginAt
                    ? `Last signed in ${formatDateTime(student.appAccount.lastLoginAt)}.`
                    : 'Linked to the student app.'
                  : 'Not yet linked. It links automatically when the student signs in to the app with this mobile number.'}
              </p>
            </Card>
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-line break-words text-sm">{student.notes || <span className="text-slate-400">No notes</span>}</p>
            </Card>
          </div>

          <p className="text-xs text-ink-muted">
            Added {formatDateTime(student.createdAt)} · Updated {formatDateTime(student.updatedAt)}
            {student.archivedAt && ` · Archived ${formatDateTime(student.archivedAt)}`}
          </p>
        </div>
      )}
    </>
  );
}
