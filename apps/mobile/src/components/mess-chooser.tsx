import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STUDENT_STATUS_LABELS } from '@mess/shared';
import { Card, Screen } from '@/components/layout';
import { useStudentMess } from '@/lib/student-mess';
import { colors } from '@/theme/tokens';
import { AppText } from './text';

/** Pick which mess to use; inactive memberships / suspended messes are shown but can't be chosen. */
export function MessChooser() {
  const { memberships, current, select } = useStudentMess();
  return (
    <Screen>
      <AppText variant="display">Choose your mess</AppText>
      <AppText muted>You&apos;re a student in more than one mess. Pick one — you can switch any time from Profile.</AppText>
      {memberships.map((m) => {
        const why = m.messStatus !== 'ACTIVE' ? 'Temporarily unavailable' : m.status !== 'ACTIVE' ? `Membership ${STUDENT_STATUS_LABELS[m.status].toLowerCase()}` : null;
        return (
          <Pressable key={m.messId} disabled={!m.usable} onPress={() => select(m.messId)} accessibilityRole="button" accessibilityState={{ disabled: !m.usable, selected: current?.messId === m.messId }}>
            <Card style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, !m.usable && { opacity: 0.55 }, current?.messId === m.messId && { borderColor: colors.brand600, borderWidth: 2 }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="title">{m.messName}</AppText>
                {why && <AppText variant="caption" muted>{why}</AppText>}
              </View>
              {m.usable && <Ionicons name="chevron-forward" size={20} color={colors.inkMuted} />}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
