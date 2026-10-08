'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { COMPLAINT_CATEGORY_LABELS, type AdminComplaintDetail } from '@mess/shared';
import { ComplaintStatusBadge } from '@/components/feedback/complaint-badges';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { PageHeader } from '@/components/ui/page-header';
import { ErrorState } from '@/components/ui/states';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, fullName } from '@/lib/format';

/** Read-only: the conversation belongs to the mess and the student. */
export default function AdminComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminComplaintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    api<AdminComplaintDetail>(`/admin/complaints/${id}`).then(setData).catch((e: unknown) => setError(errorMessage(e)));
  }, [id, attempt]);

  if (error) return <ErrorState title="Couldn't load this complaint" description={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!data) return <Skeleton className="h-64" />;

  return (
    <>
      <Link href="/admin/complaints" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden /> All complaints</Link>
      <PageHeader title={COMPLAINT_CATEGORY_LABELS[data.category]} description={`Raised ${formatDateTime(data.createdAt)}`} />
      <Card className="mb-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-ink-muted">Mess</dt><dd><Link href={`/admin/messes/${data.mess.id}`} className="font-medium text-brand-700 hover:underline">{data.mess.name}</Link></dd>
          <dt className="text-ink-muted">Student</dt><dd>{fullName(data.student)} · {data.student.mobile}</dd>
          <dt className="text-ink-muted">Status</dt><dd><ComplaintStatusBadge status={data.status} /></dd>
          {data.inProgressAt && <><dt className="text-ink-muted">Picked up</dt><dd>{formatDateTime(data.inProgressAt)}</dd></>}
          {data.resolvedAt && <><dt className="text-ink-muted">Resolved</dt><dd>{formatDateTime(data.resolvedAt)}{data.resolvedBy && ` by ${data.resolvedBy}`}</dd></>}
          <dt className="text-ink-muted">Photo</dt><dd>{data.hasAttachment ? 'Attached (visible to the mess only)' : 'None'}</dd>
        </dl>
        <p className="mt-4 whitespace-pre-wrap">{data.description}</p>
      </Card>
      <Card>
        <CardHeader title={`Replies (${data.messages.length})`} description="Read-only. Replies are handled by the mess." />
        {data.messages.length === 0 ? (
          <p className="text-sm text-ink-muted">No replies yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.messages.map((m) => (
              <li key={m.id} className="rounded-control bg-canvas p-3 text-sm">
                <p className="text-ink-muted">{m.author === 'MESS' ? m.authorName ?? 'Mess' : 'Student'} · {formatDateTime(m.createdAt)}</p>
                <p className="whitespace-pre-wrap">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
