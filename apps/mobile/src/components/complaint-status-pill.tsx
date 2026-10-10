import { StyleSheet, View } from 'react-native';
import { COMPLAINT_STATUS_LABELS, type ComplaintStatus } from '@mess/shared';
import { colors, radius, spacing, themed } from '@/theme/tokens';
import { AppText } from './text';

const COLORS: Record<ComplaintStatus, { bg: string; fg: string }> = themed(() => ({
  OPEN: { bg: colors.dangerSoft, fg: colors.danger },
  IN_PROGRESS: { bg: colors.brand100, fg: colors.brand700 },
  RESOLVED: { bg: colors.successSoft, fg: colors.success },
}));

export function ComplaintStatusPill({ status }: { status: ComplaintStatus }) {
  const c = COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <AppText variant="caption" style={{ color: c.fg, fontWeight: '600' }}>{COMPLAINT_STATUS_LABELS[status]}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({ pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 2 } });
