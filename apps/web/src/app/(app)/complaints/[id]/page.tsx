'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Phone, PlayCircle } from 'lucide-react';
import {
  can,
  COMPLAINT_CATEGORY_LABELS,
  ComplaintStatus,
  canTransition,
  FEEDBACK_LIMITS,
  Permission,
  type ComplaintDetail,
} from '@mess/shared';
import { ComplaintStatusBadge } from '@/components/feedback/complaint-badges';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageLoader, Skeleton } from '@/components/ui/loader';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, ApiError, apiObjectUrl, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { formatDateTime, formatMobile, fullName } from '@/lib/format';

/** Loads the private photo with the user's token (no public URL). */
function Attachment({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    apiObjectUrl(`/files/${id}`).then((u) => { objectUrl = u; setUrl(u); }).catch(() => setFailed(true));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  if (failed) return <p className="text-sm text-ink-muted">Photo could not be loaded.</p>;
  if (!url) return <Skeleton className="h-56 w-full" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- object URL of a private file */}
      <img src={url} alt="Photo attached to the complaint" className="max-h-96 rounded-control border border-border object-contain" />
    </a>
  );
}

function ComplaintScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const toast = useToast();
  const canManage = can(session?.role, Permission.COMPLAINT_MANAGE);
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<'reply' | 'IN_PROGRESS' | 'RESOLVED' | null>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api<ComplaintDetail>(`/complaints/${id}`)
      .then(setComplaint)
      .catch((e: unknown) => setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 }));
  }, [id]);
  useEffect(load, [load]);

  const setStatus = async (status: ComplaintStatus) => {
    setBusy(status as 'IN_PROGRESS' | 'RESOLVED');
    try {
      setComplaint(await api<ComplaintDetail>(`/complaints/${id}/status`, { method: 'PATCH', body: { status } }));
      toast.success(status === ComplaintStatus.RESOLVED ? 'Complaint resolved' : 'Marked in progress', 'The student has been notified.');
      setConfirmResolve(false);
    } catch (e) {
      toast.error('Could not update', errorMessage(e));
      load();
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!reply.trim()) return;
    setBusy('reply');
    try {
      setComplaint(await api<ComplaintDetail>(`/complaints/${id}/responses`, { method: 'POST', body: { message: reply.trim() } }));
      setReply('');
      toast.success('Reply sent', 'The student will see it in the app.');
    } catch (e) {
      toast.error('Could not send reply', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const back = (
    <Link href="/complaints" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Complaints
    </Link>
  );
  if (error) return <>{back}{error.notFound ? <EmptyState title="Complaint not found" /> : <ErrorState description={error.message} onRetry={load} />}</>;
  if (!complaint) return <>{back}<PageLoader /></>;
  const resolved = complaint.status === ComplaintStatus.RESOLVED;

  return (
    <>
      {back}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display font-bold tracking-tight">{COMPLAINT_CATEGORY_LABELS[complaint.category]}</h1>
            <ComplaintStatusBadge status={complaint.status} />
          </div>
          <p className="text-ink-muted">Raised {formatDateTime(complaint.createdAt)}</p>
        </div>
        {canManage && !resolved && (
          <div className="flex flex-wrap gap-2">
            {canTransition(complaint.status, ComplaintStatus.IN_PROGRESS) && (
              <Button variant="secondary" loading={busy === 'IN_PROGRESS'} onClick={() => setStatus(ComplaintStatus.IN_PROGRESS)}>
                <PlayCircle className="size-4" aria-hidden /> Start work
              </Button>
            )}
            <Button onClick={() => setConfirmResolve(true)}><CheckCircle2 className="size-4" aria-hidden /> Resolve</Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Complaint" />
            <p className="whitespace-pre-line break-words">{complaint.description}</p>
            {complaint.attachmentId && <div className="mt-4"><Attachment id={complaint.attachmentId} /></div>}
          </Card>

          <Card>
            <CardHeader title="Replies" />
            {complaint.messages.length === 0 ? <p className="text-sm text-ink-muted">No replies yet.</p> : (
              <ol className="flex flex-col gap-3">
                {complaint.messages.map((m) => (
                  <li key={m.id} className={cn('rounded-control p-3', m.author === 'MESS' ? 'bg-brand-50' : 'bg-canvas')}>
                    <p className="text-xs text-ink-muted">{m.author === 'MESS' ? (m.authorName ?? 'Mess') : 'Student'} · {formatDateTime(m.createdAt)}</p>
                    <p className="whitespace-pre-line break-words">{m.message}</p>
                  </li>
                ))}
              </ol>
            )}
            {canManage && !resolved && (
              <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-4 flex flex-col gap-2">
                <label htmlFor="reply" className="text-sm font-medium">Reply to the student</label>
                <textarea id="reply" rows={3} maxLength={FEEDBACK_LIMITS.responseMax} value={reply} onChange={(e) => setReply(e.target.value)} className="rounded-control border border-border bg-surface p-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">{reply.length}/{FEEDBACK_LIMITS.responseMax}</span>
                  <Button type="submit" loading={busy === 'reply'} disabled={!reply.trim()}>Send reply</Button>
                </div>
              </form>
            )}
            {resolved && <Alert tone="success" className="mt-4">Resolved {complaint.resolvedAt && formatDateTime(complaint.resolvedAt)}{complaint.resolvedBy && ` by ${complaint.resolvedBy}`}. Replies are closed.</Alert>}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Student" />
            <Link href={`/students/${complaint.student.id}`} className="font-semibold hover:underline">{fullName(complaint.student)}</Link>
            <a href={`tel:+91${complaint.student.mobile}`} className="mt-1 flex min-h-11 items-center gap-1.5 text-ink-muted hover:text-ink">
              <Phone className="size-4" aria-hidden /> {formatMobile(complaint.student.mobile)}
            </a>
          </Card>
          <Card>
            <CardHeader title="History" />
            <ol className="flex flex-col gap-2 text-sm">
              <li><span className="text-ink-muted">Raised</span> · {formatDateTime(complaint.createdAt)}</li>
              {complaint.inProgressAt && <li><span className="text-ink-muted">Work started</span> · {formatDateTime(complaint.inProgressAt)}</li>}
              {complaint.resolvedAt && <li><span className="text-ink-muted">Resolved</span> · {formatDateTime(complaint.resolvedAt)}</li>}
            </ol>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmResolve}
        title="Resolve this complaint?"
        description="The student will be told it is resolved. Resolved complaints can't be reopened or replied to."
        confirmLabel="Resolve"
        loading={busy === 'RESOLVED'}
        onConfirm={() => setStatus(ComplaintStatus.RESOLVED)}
        onCancel={() => setConfirmResolve(false)}
      />
    </>
  );
}

export default function ComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth permission={Permission.COMPLAINT_VIEW}>
      <ComplaintScreen id={id} />
    </RequireAuth>
  );
}
