import { useState } from 'react';
import { Alert, View } from 'react-native';
import { formatPaise, istToday, mealsLabel, planRequestStatusText, type MealPlan, type PlanRequestItem } from '@mess/shared';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/student-profile';
import { useApi } from '@/lib/team';
import { colors } from '@/theme/tokens';
import { Button } from './button';
import { Card } from './layout';
import { Pill } from './team/kit';
import { AppText } from './text';
import { useToast } from './toast';

const TONE = { PENDING: 'brand', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'neutral' } as const;

/** Active plans of the selected mess; "Choose plan" sends a request the mess approves (no activation/payment here). */
export function ChoosePlan() {
  const toast = useToast();
  const plans = useApi<MealPlan[]>('/students/me/plans');
  const requests = useApi<PlanRequestItem[]>('/students/me/plan-requests');
  const [busy, setBusy] = useState(false);
  const pending = requests.data?.find((r) => r.status === 'PENDING');

  const send = (p: MealPlan) =>
    Alert.alert(`Request ${p.name}?`, 'Your mess will confirm it. It starts once approved (after your current plan, if any). Pay at the mess as usual.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send request',
        onPress: async () => {
          setBusy(true);
          try {
            await api('/students/me/plan-requests', { method: 'POST', body: { mealPlanId: p.id } });
            toast.show('Request sent to your mess', 'success');
            await requests.reload();
          } catch (e) {
            toast.show(errorMessage(e), 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  const withdraw = async (id: string) => {
    try {
      await api(`/students/me/plan-requests/${id}/cancel`, { method: 'POST' });
      await requests.reload();
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {requests.data?.slice(0, 3).map((r) => (
        <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '600' }}>{r.planName} · {formatPaise(r.planPricePaise)}</AppText>
            {r.rejectReason && <AppText variant="caption" muted>“{r.rejectReason}”</AppText>}
          </View>
          <Pill label={planRequestStatusText(r, istToday(), formatDate)} tone={TONE[r.status]} />
          {r.status === 'PENDING' && <Button title="Withdraw" variant="ghost" onPress={() => void withdraw(r.id)} />}
        </Card>
      ))}
      <AppText variant="label" muted>AVAILABLE PLANS</AppText>
      {pending && <AppText variant="caption" muted>Your request is waiting for your mess. Withdraw it to choose a different plan.</AppText>}
      {plans.error ? (
        <AppText style={{ color: colors.danger }}>{plans.error}</AppText>
      ) : !plans.data ? (
        <AppText muted>Loading…</AppText>
      ) : !plans.data.length ? (
        <AppText muted>Your mess has no plans available right now.</AppText>
      ) : (
        plans.data.map((p) => (
          <Card key={p.id}>
            <AppText variant="title">{p.name} · ₹{p.price}</AppText>
            <AppText muted>{mealsLabel(p)} · {p.durationValue} {p.durationType === 'DAYS' ? 'day(s)' : 'month(s)'} · {p.mealCredits ? `${p.mealCredits}-meal pack` : 'unlimited meals'}</AppText>
            {p.description && <AppText>{p.description}</AppText>}
            <Button title="Choose plan" variant="secondary" disabled={!!pending} loading={busy} onPress={() => send(p)} />
          </Card>
        ))
      )}
    </View>
  );
}
