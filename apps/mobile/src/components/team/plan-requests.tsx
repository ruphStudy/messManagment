import { View } from 'react-native';
import { formatPaise, Permission, type PlanRequestItem } from '@mess/shared';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/layout';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { confirm, mutate, useApi, useCan } from '@/lib/team';
import { SectionTitle } from './kit';

/** Students' plan choices waiting for approval. Approve = normal plan assignment (all its rules); reject keeps history. */
export function PlanRequests({ onApproved }: { onApproved?: () => void }) {
  const can = useCan();
  const toast = useToast();
  const { data, reload } = useApi<PlanRequestItem[]>('/plan-requests?status=PENDING');
  if (!data?.length) return null;
  const decide = (r: PlanRequestItem, approve: boolean) =>
    confirm(
      approve ? `Assign ${r.planName}?` : 'Reject this request?',
      approve ? 'Starts today, or the day after their current plan ends. The fee is added to their dues.' : 'No plan is assigned. The student can choose again.',
      approve ? 'Approve' : 'Reject',
      () =>
        void mutate(() => api(`/plan-requests/${r.id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: {} }), toast, approve ? 'Plan assigned' : 'Request rejected').then((res) => {
          void reload();
          if (res && approve) onApproved?.();
        }),
      !approve,
    );
  return (
    <Card>
      <SectionTitle>{`Plan requests (${data.length})`}</SectionTitle>
      {data.map((r) => (
        <View key={r.id} style={{ gap: 4, paddingVertical: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar name={[r.student?.firstName, r.student?.lastName].filter(Boolean).join(' ')} size={32} />
            <AppText style={{ fontWeight: '600', flex: 1 }}>{[r.student?.firstName, r.student?.lastName].filter(Boolean).join(' ')} · {r.planName} · {formatPaise(r.planPricePaise)}</AppText>
          </View>
          <AppText variant="caption" muted>{r.student?.mobile} · requested {new Date(r.createdAt).toLocaleDateString('en-IN')}</AppText>
          {can(Permission.SUBSCRIPTION_MANAGE) && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Approve" onPress={() => decide(r, true)} /></View>
              <View style={{ flex: 1 }}><Button title="Reject" variant="secondary" onPress={() => decide(r, false)} /></View>
            </View>
          )}
        </View>
      ))}
    </Card>
  );
}
