import { View } from 'react-native';
import { personInitials } from '@mess/shared';
import { colors } from '@/theme/tokens';
import { AppText } from './text';

/** Initials circle (no photos). Decorative: the name is always shown next to it. */
export function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  return (
    <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ color: colors.brand700, fontWeight: '700', fontSize: size * 0.38 }}>{personInitials(name)}</AppText>
    </View>
  );
}
