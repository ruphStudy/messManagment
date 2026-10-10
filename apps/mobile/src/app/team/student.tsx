import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  DEFAULT_COUNTRY_CODE,
  formatPaise,
  MEAL_LABELS,
  Permission,
  REMINDER_REASON_LABELS,
  ReminderReason,
  STUDENT_STATUS_LABELS,
  StudentStatus,
  SUBSCRIPTION_STATUS_LABELS,
  type PauseRecord,
  type ReminderResult,
  type StudentDetail,
  type SubscriptionSummary,
} from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, ListItem, MultilineInput, Pill, Row, SectionTitle } from '@/components/team/kit';
import { SuspendedBanner } from '@/components/team/suspended-banner';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { confirm, mutate, useApi, useCan } from '@/lib/team';
import { formatDate } from '@/lib/student-profile';

const phone = (m: string | null) => (m ? `${DEFAULT_COUNTRY_CODE} ${m}` : null);

function Reminder({ studentId }: { studentId: string }) {
  const toast = useToast();
  const [reason, setReason] = useState<ReminderReason>(ReminderReason.PAYMENT);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    const res = await mutate(() => api<ReminderResult>(`/students/${studentId}/reminders`, { method: 'POST', body: { reason, ...(note.trim() ? { note: note.trim() } : {}) } }), toast);
    if (res) toast.show(res.sent.length ? 'Reminder sent' : `Not sent: ${[...res.skipped, ...res.failed][0]?.reason ?? 'nothing to send'}`, res.sent.length ? 'success' : 'info');
    setSending(false);
  };
  return (
    <Card>
      <SectionTitle>Send reminder</SectionTitle>
      <Chips options={Object.values(ReminderReason).map((r) => ({ value: r, label: REMINDER_REASON_LABELS[r] }))} value={reason} onChange={setReason} />
      <MultilineInput value={note} onChange={setNote} placeholder="Note (optional)" maxLength={200} />
      <Button title="Send reminder" variant="secondary" onPress={send} loading={sending} />
    </Card>
  );
}

/** Student detail for the team: profile, plans, fees, upcoming pauses and the actions the role allows. */
export default function StudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const can = useCan();
  const toast = useToast();
  const student = useApi<StudentDetail>(`/students/${id}`);
  const subs = useApi<SubscriptionSummary[]>(`/students/${id}/subscriptions`);
  const pauses = useApi<PauseRecord[]>(`/pauses?studentId=${id}&status=ACTIVE&pageSize=20`);
  const [busy, setBusy] = useState(false);
  if (student.error && !student.data) return <ErrorState title="Couldn't load this student" description={student.error} onRetry={student.reload} />;
  const s = student.data;
  if (!s) return <FullScreenLoader />;
  const name = [s.firstName, s.lastName].filter(Boolean).join(' ');
  const refresh = () => { void student.reload(); void subs.reload(); void pauses.reload(); };
  const act = (path: string, body: object | undefined, done: string) =>
    void (async () => {
      setBusy(true);
      const res = await mutate(() => api<StudentDetail>(`/students/${id}/${path}`, { method: path === 'status' ? 'PATCH' : 'POST', body }), toast, done);
      if (res) student.setData(res);
      setBusy(false);
    })();
  const current = subs.data?.find((x) => x.status === 'ACTIVE') ?? subs.data?.find((x) => x.status === 'UPCOMING');

  return (
    <Screen edges={[]} onRefresh={refresh} refreshing={student.loading}>
      <SuspendedBanner />
      <View style={{ gap: 4 }}>
        <AppText variant="title">{name}</AppText>
        <Pill label={STUDENT_STATUS_LABELS[s.status]} tone={s.status === StudentStatus.ACTIVE ? 'success' : 'neutral'} />
      </View>
      <Card>
        <Row label="Mobile" value={phone(s.mobile) ?? '—'} />
        <Row label="Joined" value={formatDate(s.joiningDate)} />
        <Row label="College" value={s.collegeName ?? '—'} />
        <Row label="Hostel / PG" value={s.hostelOrPg ?? '—'} />
        <Row label="App" value={s.appAccount.linked ? 'Linked' : 'Not signed in yet'} />
        {s.parentMobile && <Row label="Parent" value={`${s.parentName ?? ''} ${phone(s.parentMobile)}`.trim()} />}
        {s.notes && <Row label="Notes" value={s.notes} />}
      </Card>

      <SectionTitle>Meal plans</SectionTitle>
      {subs.data?.length ? (
        subs.data.slice(0, 5).map((x) => (
          <ListItem
            key={x.id}
            title={`${x.plan.name} · ${SUBSCRIPTION_STATUS_LABELS[x.status]}`}
            subtitle={`${formatDate(x.startDate)} – ${formatDate(x.endDate)} · paid ${formatPaise(x.payment.paidPaise)} of ${formatPaise(x.payment.payablePaise)}${x.payment.duePaise ? ` · due ${formatPaise(x.payment.duePaise)}` : ''}`}
            onPress={can(Permission.SUBSCRIPTION_MANAGE) ? () => router.push({ pathname: '/team/subscription', params: { studentId: id, subscriptionId: x.id } }) : undefined}
          />
        ))
      ) : (
        <AppText muted>No meal plan yet.</AppText>
      )}
      {can(Permission.SUBSCRIPTION_MANAGE) && s.status === StudentStatus.ACTIVE && (
        <Button title={current ? 'Renew / change plan' : 'Assign meal plan'} variant="secondary" onPress={() => router.push({ pathname: '/team/subscription', params: { studentId: id, ...(current ? { subscriptionId: current.id } : {}) } })} />
      )}
      {can(Permission.PAYMENT_RECORD) && current && current.payment.duePaise > 0 && (
        <Button title={`Record payment (${formatPaise(current.payment.duePaise)} due)`} onPress={() => router.push({ pathname: '/team/payment-new', params: { studentId: id } })} />
      )}

      <SectionTitle>Upcoming pauses</SectionTitle>
      {pauses.data?.length ? pauses.data.map((p) => <ListItem key={p.id} title={`${MEAL_LABELS[p.mealType]} · ${formatDate(p.date)}`} subtitle={p.reason ?? undefined} />) : <AppText muted>None.</AppText>}
      {can(Permission.PAUSE_MANAGE) && <Button title="Add pause" variant="secondary" onPress={() => router.push({ pathname: '/team/pause-new', params: { studentId: id } })} />}

      {can(Permission.REMINDER_SEND) && s.status === StudentStatus.ACTIVE && <Reminder studentId={id} />}

      {can(Permission.STUDENT_MANAGE) && s.status !== StudentStatus.ARCHIVED && (
        <>
          <Button title="Edit details" variant="secondary" onPress={() => router.push({ pathname: '/team/student-form', params: { id } })} />
          <Button
            title={s.status === StudentStatus.ACTIVE ? 'Mark inactive' : 'Mark active'}
            variant="secondary"
            loading={busy}
            onPress={() =>
              confirm(s.status === StudentStatus.ACTIVE ? 'Mark inactive?' : 'Mark active?', s.status === StudentStatus.ACTIVE ? 'They stay in your records but cannot be served meals.' : 'They can be served meals again.', 'Confirm', () =>
                act('status', { status: s.status === StudentStatus.ACTIVE ? 'INACTIVE' : 'ACTIVE' }, 'Status updated'),
              )
            }
          />
        </>
      )}
      {can(Permission.STUDENT_ARCHIVE) &&
        (s.status === StudentStatus.ARCHIVED ? (
          <Button title="Restore student" variant="secondary" loading={busy} onPress={() => confirm('Restore student?', 'They come back as inactive.', 'Restore', () => act('restore', undefined, 'Student restored'))} />
        ) : (
          <Button title="Archive student" variant="danger" loading={busy} onPress={() => confirm('Archive student?', 'Hidden from lists; history is kept. You can restore later.', 'Archive', () => act('archive', undefined, 'Student archived'), true)} />
        ))}
    </Screen>
  );
}
