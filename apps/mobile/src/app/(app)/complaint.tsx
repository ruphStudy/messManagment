import { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { COMPLAINT_CATEGORY_LABELS, ComplaintStatus, type StudentComplaintDetail } from '@mess/shared';
import { ComplaintStatusPill } from '@/components/complaint-status-pill';
import { Card, Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { api, ApiError, authorizedFileSource, errorMessage } from '@/lib/api';
import { colors, radius, spacing, themed } from '@/theme/tokens';

const timeFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const when = (iso: string) => timeFormat.format(new Date(iso));

/** Read-only complaint with its timeline. The original complaint can't be edited after sending. */
export default function ComplaintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [complaint, setComplaint] = useState<StudentComplaintDetail | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setComplaint(await api<StudentComplaintDetail>(`/students/me/complaints/${id}`));
    } catch (e) {
      setError({ message: errorMessage(e), notFound: e instanceof ApiError && e.status === 404 });
    } finally {
      setLoading(false);
    }
  }, [id]);
  useFocusEffect(useCallback(() => void load(), [load]));

  if (error) return error.notFound ? <EmptyState icon="chatbubble-ellipses-outline" title="Complaint not found" /> : <ErrorState description={error.message} onRetry={load} />;
  if (!complaint) return <FullScreenLoader />;
  const resolved = complaint.status === ComplaintStatus.RESOLVED;

  return (
    <Screen edges={[]} onRefresh={load} refreshing={loading}>
      <Card>
        <View style={styles.row}>
          <AppText variant="title" style={{ flex: 1 }}>{COMPLAINT_CATEGORY_LABELS[complaint.category]}</AppText>
          <ComplaintStatusPill status={complaint.status} />
        </View>
        <AppText variant="caption" muted>Sent {when(complaint.createdAt)}</AppText>
        <AppText>{complaint.description}</AppText>
        {complaint.attachmentId && !photoFailed && (
          <Image source={authorizedFileSource(complaint.attachmentId)} style={styles.photo} resizeMode="cover" onError={() => setPhotoFailed(true)} accessibilityLabel="Photo you attached" />
        )}
      </Card>

      {resolved && (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: 'transparent' }}>
          <AppText style={{ color: colors.success, fontWeight: '700' }}>Resolved{complaint.resolvedAt ? ` · ${when(complaint.resolvedAt)}` : ''}</AppText>
        </Card>
      )}

      <AppText variant="label" muted>UPDATES</AppText>
      <Card style={{ gap: spacing.md }}>
        <TimelineItem title="Complaint sent" time={complaint.createdAt} />
        {complaint.inProgressAt && <TimelineItem title="Mess started working on it" time={complaint.inProgressAt} />}
        {complaint.messages.map((m) => (
          <View key={m.id} style={[styles.message, m.author === 'MESS' ? styles.fromMess : styles.fromMe]}>
            <AppText variant="caption" muted>{m.author === 'MESS' ? (m.authorName ?? 'Your mess') : 'You'} · {when(m.createdAt)}</AppText>
            <AppText>{m.message}</AppText>
          </View>
        ))}
        {complaint.resolvedAt && <TimelineItem title="Marked resolved" time={complaint.resolvedAt} />}
        {!resolved && complaint.messages.length === 0 && <AppText variant="caption" muted>No replies yet. Pull down to refresh.</AppText>}
      </Card>
    </Screen>
  );
}

function TimelineItem({ title, time }: { title: string; time: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.dot} />
      <AppText style={{ flex: 1 }}>{title}</AppText>
      <AppText variant="caption" muted>{when(time)}</AppText>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.control, marginTop: spacing.sm, backgroundColor: colors.canvas },
  message: { borderRadius: radius.control, padding: spacing.md, gap: 2 },
  fromMess: { backgroundColor: colors.brand50 },
  fromMe: { backgroundColor: colors.canvas },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand500 },
}));
