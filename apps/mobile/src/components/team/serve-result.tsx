import { MEAL_LABELS, type ServeResult } from '@mess/shared';
import { Card } from '@/components/layout';
import { AppText } from '@/components/text';
import { colors } from '@/theme/tokens';

/** Big green/red outcome after a scan or manual mark; the reason text comes from the API. */
export function ServeResultCard({ result }: { result: ServeResult }) {
  const ok = result.outcome === 'SERVED';
  const student = ok ? result.attendance.student : result.student;
  const name = student ? [student.firstName, student.lastName].filter(Boolean).join(' ') : null;
  return (
    <Card style={{ backgroundColor: ok ? colors.successSoft : colors.dangerSoft, borderColor: 'transparent' }}>
      <AppText variant="title" style={{ color: ok ? colors.success : colors.danger }}>
        {ok ? `✓ ${MEAL_LABELS[result.attendance.mealType]} served` : '✕ Not served'}
      </AppText>
      {name && <AppText style={{ fontWeight: '600' }}>{name}</AppText>}
      {ok ? (
        result.attendance.remainingMealCredits !== null && <AppText muted>{result.attendance.remainingMealCredits} meals left on {result.attendance.planName}</AppText>
      ) : (
        <AppText style={{ color: colors.danger }}>{result.message}</AppText>
      )}
    </Card>
  );
}
