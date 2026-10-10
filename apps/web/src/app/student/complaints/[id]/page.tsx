'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { COMPLAINT_CATEGORY_LABELS, ComplaintStatus, type StudentComplaintDetail } from '@mess/shared';
import { ComplaintStatusBadge } from '@/components/feedback/complaint-badges';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/loader';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { apiObjectUrl } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/student/use-api';

/** Own photo through the authorized file endpoint (same as the app). */
function Photo({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current: string | null = null;
    apiObjectUrl(`/files/${id}`).then((u) => setUrl((current = u))).catch(() => setFailed(true));
    return () => {
      if (current) URL.revokeObjectURL(current);
    };
  }, [id]);
  if (failed) return <p className="text-sm text-ink-muted">Photo couldn&apos;t be loaded.</p>;
  if (!url) return <Skeleton className="h-48 w-full max-w-sm" />;
  // eslint-disable-next-line @next/next/no-img-element -- authorized object URL
  return <img src={url} alt="Photo you attached" className="max-h-80 w-full max-w-sm rounded-control object-cover" />;
}

/** Read-only complaint with its timeline (students can't edit after sending). */
export default function StudentComplaintPage() {
  const { id } = useParams<{ id: string }>();
  const { data: c, error, loading, reload } = useApi<StudentComplaintDetail>(`/students/me/complaints/${id}`);
  if (error) return error.toLowerCase().includes('not found') ? <EmptyState title="Complaint not found" /> : <ErrorState description={error} onRetry={reload} />;
  if (!c) return <Skeleton className="h-64" />;
  const resolved = c.status === ComplaintStatus.RESOLVED;
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Link href="/student/complaints" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden /> My complaints</Link>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2"><h1 className="flex-1 text-xl font-semibold">{COMPLAINT_CATEGORY_LABELS[c.category]}</h1><ComplaintStatusBadge status={c.status} /></div>
        <p className="text-xs text-ink-muted">Sent {formatDateTime(c.createdAt)}</p>
        <p className="whitespace-pre-wrap">{c.description}</p>
        {c.attachmentId && <Photo id={c.attachmentId} />}
      </Card>
      {resolved && <Card className="border-transparent bg-success-soft font-semibold text-success">Resolved{c.resolvedAt ? ` · ${formatDateTime(c.resolvedAt)}` : ''}</Card>}
      <Card>
        <CardHeader title="Updates" action={<Button size="sm" variant="ghost" onClick={reload} loading={loading}>Refresh</Button>} />
        <ol className="flex flex-col gap-3 text-sm">
          <li className="flex justify-between gap-2"><span>Complaint sent</span><span className="text-ink-muted">{formatDateTime(c.createdAt)}</span></li>
          {c.inProgressAt && <li className="flex justify-between gap-2"><span>Mess started working on it</span><span className="text-ink-muted">{formatDateTime(c.inProgressAt)}</span></li>}
          {c.messages.map((m) => (
            <li key={m.id} className={m.author === 'MESS' ? 'rounded-control bg-canvas p-3' : 'rounded-control bg-brand-50 p-3'}>
              <p className="text-xs text-ink-muted">{m.author === 'MESS' ? (m.authorName ?? 'Your mess') : 'You'} · {formatDateTime(m.createdAt)}</p>
              <p className="whitespace-pre-wrap">{m.message}</p>
            </li>
          ))}
          {c.resolvedAt && <li className="flex justify-between gap-2"><span>Marked resolved</span><span className="text-ink-muted">{formatDateTime(c.resolvedAt)}</span></li>}
          {!resolved && c.messages.length === 0 && <li className="text-ink-muted">No replies yet.</li>}
        </ol>
      </Card>
    </div>
  );
}
