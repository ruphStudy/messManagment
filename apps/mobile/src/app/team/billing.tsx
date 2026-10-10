import { useEffect } from 'react';
import { Linking } from 'react-native';
import { BILLING_CYCLE_LABELS, billingHeadline, billingPeriodLabel, formatPaise, PLATFORM_SUBSCRIPTION_STATUS_LABELS, PLATFORM_TRIAL_DAYS, type PlatformBillingSummary } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { Pill, Row, SectionTitle } from '@/components/team/kit';
import { AppText } from '@/components/text';
import { formatDate } from '@/lib/student-profile';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/team';
import { colors } from '@/theme/tokens';

/** MessMate (SaaS) subscription for this mess — read-only; payments are recorded by the platform team. */
export default function TeamBillingScreen() {
  const { data, error, reload } = useApi<PlatformBillingSummary>('/billing');
  const { session, refreshSession } = useAuth();
  // Activated/expired since sign-in → recheck the session so the banner on other screens matches.
  const stale = !!data && !!session?.billing && session.billing.accessAllowed !== data.accessAllowed;
  useEffect(() => {
    if (stale) void refreshSession().catch(() => undefined);
  }, [stale, refreshSession]);
  if (error) return <ErrorState title="Couldn't load your subscription" description={error} onRetry={reload} />;
  if (!data) return <FullScreenLoader />;
  const head = billingHeadline(data, formatDate);
  const c = data.current;
  const { email, phone } = data.support;
  return (
    <Screen edges={[]}>
      <Card>
        <Pill label={PLATFORM_SUBSCRIPTION_STATUS_LABELS[data.status]} tone={head.tone} />
        <AppText style={{ marginTop: 8, fontWeight: '600', color: head.tone === 'danger' ? colors.danger : colors.ink }}>{head.text}</AppText>
      </Card>
      <Card>
        <Row label="Plan" value={c?.planName ?? '—'} />
        <Row label="Billing cycle" value={c?.billingCycle ? BILLING_CYCLE_LABELS[c.billingCycle] : '—'} />
        <Row label="Price" value={c?.amountPaise ? formatPaise(c.amountPaise) : '—'} />
        <Row label="Start date" value={c?.startDate ? formatDate(c.startDate) : '—'} />
        <Row label="Expiry date" value={data.accessUntil ? formatDate(data.accessUntil) : '—'} />
        <Row label="Days remaining" value={data.daysRemaining != null ? String(data.daysRemaining) : '—'} />
        {c?.trialStartDate && c.trialEndDate && <Row label={`Trial (${PLATFORM_TRIAL_DAYS} days)`} value={`${formatDate(c.trialStartDate)} – ${formatDate(c.trialEndDate)}`} />}
        <Row label="Payment reference" value={c?.paymentReference ?? '—'} />
      </Card>
      {data.upcoming.length > 0 && <SectionTitle>Upcoming</SectionTitle>}
      {data.upcoming.map((u) => (
        <Card key={u.id}>
          <Pill label="Upcoming" tone="info" />
          <AppText style={{ marginTop: 6, fontWeight: '600' }}>{u.planName}</AppText>
          <AppText muted>{billingPeriodLabel(u, formatDate, formatPaise)}</AppText>
        </Card>
      ))}
      <SectionTitle>Contact support</SectionTitle>
      <AppText muted>Contact support to activate, renew or start a trial.</AppText>
      {email && <Button title={`Email ${email}`} onPress={() => void Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('MessMate subscription')}`)} />}
      {phone && <Button title={`Call ${phone}`} variant="secondary" onPress={() => void Linking.openURL(`tel:${phone}`)} />}
      {!email && !phone && <AppText muted>Support contact isn't configured yet.</AppText>}
    </Screen>
  );
}
