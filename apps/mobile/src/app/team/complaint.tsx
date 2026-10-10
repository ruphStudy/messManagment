import { useState } from 'react';
import { Image, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { COMPLAINT_CATEGORY_LABELS, COMPLAINT_STATUS_LABELS, ComplaintStatus, FEEDBACK_LIMITS, Permission, type ComplaintDetail } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { MultilineInput, Pill, SectionTitle } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api, authorizedFileSource } from '@/lib/api';
import { confirm, mutate, useApi, useCan } from '@/lib/team';
import { colors, radius } from '@/theme/tokens';

const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Complaint detail; owner/manager reply, start and resolve (staff read-only). Photo via the authorized file endpoint. */
export default function TeamComplaintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const can = useCan();
  const toast = useToast();
  const { data: c, setData, error, loading, reload } = useApi<ComplaintDetail>(`/complaints/${id}`);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  if (error && !c) return <ErrorState title="Couldn't load the complaint" description={error} onRetry={reload} />;
  if (!c) return <FullScreenLoader />;
  const manage = can(Permission.COMPLAINT_MANAGE) && c.status !== ComplaintStatus.RESOLVED;
  const run = async (fn: () => Promise<ComplaintDetail>, done: string) => {
    setBusy(true);
    const res = await mutate(fn, toast, done);
    if (res) setData(res);
    setBusy(false);
    return res;
  };
  return (
    <Screen edges={[]} onRefresh={reload} refreshing={loading}>
      <SuspendedBanner />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppText variant="title" style={{ flex: 1 }}>{COMPLAINT_CATEGORY_LABELS[c.category]}</AppText>
          <Pill label={COMPLAINT_STATUS_LABELS[c.status]} tone={c.status === 'RESOLVED' ? 'success' : c.status === 'OPEN' ? 'danger' : 'brand'} />
        </View>
        <AppText muted>{[c.student.firstName, c.student.lastName].filter(Boolean).join(' ')} · {c.student.mobile} · {when.format(new Date(c.createdAt))}</AppText>
        <AppText>{c.description}</AppText>
        {c.attachmentId && !photoFailed && <Image source={authorizedFileSource(c.attachmentId)} style={{ height: 220, borderRadius: radius.control }} resizeMode="cover" onError={() => setPhotoFailed(true)} accessibilityLabel="Complaint photo" />}
      </Card>
      <SectionTitle>Replies</SectionTitle>
      {c.messages.length ? c.messages.map((m) => (
        <Card key={m.id} style={{ backgroundColor: m.author === 'MESS' ? colors.surface : colors.brand50 }}>
          <AppText variant="caption" muted>{m.author === 'MESS' ? (m.authorName ?? 'Mess') : 'Student'} · {when.format(new Date(m.createdAt))}</AppText>
          <AppText>{m.message}</AppText>
        </Card>
      )) : <AppText muted>No replies yet.</AppText>}
      {c.resolvedAt && <AppText style={{ color: colors.success, fontWeight: '600' }}>Resolved {when.format(new Date(c.resolvedAt))}{c.resolvedBy ? ` by ${c.resolvedBy}` : ''}</AppText>}
      {manage && (
        <Card>
          <MultilineInput value={reply} onChange={setReply} placeholder="Reply to the student" maxLength={FEEDBACK_LIMITS.responseMax} />
          <Button title="Send reply" variant="secondary" loading={busy} disabled={!reply.trim()} onPress={() => void run(() => api<ComplaintDetail>(`/complaints/${c.id}/responses`, { method: 'POST', body: { message: reply.trim() } }), 'Reply sent').then((r) => r && setReply(''))} />
          {c.status === ComplaintStatus.OPEN && <Button title="Mark in progress" variant="secondary" loading={busy} onPress={() => void run(() => api<ComplaintDetail>(`/complaints/${c.id}/status`, { method: 'PATCH', body: { status: ComplaintStatus.IN_PROGRESS } }), 'Marked in progress')} />}
          <Button title="Resolve" loading={busy} onPress={() => confirm('Mark as resolved?', 'The student is notified. Resolved complaints cannot be reopened or replied to.', 'Resolve', () => void run(() => api<ComplaintDetail>(`/complaints/${c.id}/status`, { method: 'PATCH', body: { status: ComplaintStatus.RESOLVED } }), 'Complaint resolved'))} />
        </Card>
      )}
    </Screen>
  );
}
