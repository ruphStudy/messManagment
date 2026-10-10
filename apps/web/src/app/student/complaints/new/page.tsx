'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, X } from 'lucide-react';
import { ATTACHMENT_LIMITS, COMPLAINT_CATEGORY_LABELS, ComplaintCategory, FEEDBACK_LIMITS, type StudentComplaintDetail, type UploadedFile } from '@mess/shared';
import { LinkedOnly } from '@/components/student/linked-only';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';

/** Not security-sensitive: only stops a double-click/retry from creating two complaints. */
const newKey = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

function NewComplaint() {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useRef(newKey());
  const uploadedId = useRef<string | null>(null);

  const choose = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!(ATTACHMENT_LIMITS.mimeTypes as readonly string[]).includes(file.type)) return setError('Choose a JPEG, PNG or WebP photo.');
    if (file.size > ATTACHMENT_LIMITS.maxBytes) return setError('Photo is larger than 5 MB.');
    uploadedId.current = null;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };
  const removePhoto = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(null);
    setPreview(null);
    uploadedId.current = null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (photo && !uploadedId.current) {
        const form = new FormData();
        form.append('file', photo);
        uploadedId.current = (await api<UploadedFile>('/students/me/uploads/complaint-photo', { method: 'POST', body: form })).id;
      }
      const created = await api<StudentComplaintDetail>('/students/me/complaints', {
        method: 'POST',
        body: { category, description: description.trim(), idempotencyKey: key.current, ...(uploadedId.current ? { attachmentId: uploadedId.current } : {}) },
      });
      toast.success('Complaint sent');
      router.replace(`/student/complaints/${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">What is it about?</legend>
          <div className="flex flex-wrap gap-2">
            {Object.values(ComplaintCategory).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)} className={cn('min-h-11 rounded-full border px-4 text-sm font-semibold', category === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-surface hover:bg-canvas')}>
                {COMPLAINT_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">Describe the problem</label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={FEEDBACK_LIMITS.complaintMax} placeholder="What happened, and when?" className="min-h-32 w-full rounded-control border border-border bg-surface p-3" />
          <p className="text-right text-xs text-ink-muted">{description.length}/{FEEDBACK_LIMITS.complaintMax}</p>
        </div>
        {preview ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
            <img src={preview} alt="Selected photo" className="size-20 rounded-control object-cover" />
            <Button variant="ghost" onClick={removePhoto}><X className="size-4" aria-hidden /> Remove photo</Button>
          </div>
        ) : (
          <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-control border border-dashed border-brand-300 px-4 font-semibold text-brand-700 hover:bg-brand-50">
            <Camera className="size-5" aria-hidden /> Add photo (optional)
            <input type="file" accept={ATTACHMENT_LIMITS.mimeTypes.join(',')} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
          </label>
        )}
        <p className="text-xs text-ink-muted">Your mess owner/manager will review this.</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <div><Button type="submit" loading={saving} disabled={!category || !description.trim()}>Send complaint</Button></div>
      </Card>
    </form>
  );
}

export default function NewComplaintPage() {
  return (
    <>
      <Link href="/student/complaints" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden /> My complaints</Link>
      <PageHeader title="Raise a complaint" />
      <LinkedOnly><NewComplaint /></LinkedOnly>
    </>
  );
}
