import { Text, type TextProps } from 'react-native';
import { colors, typography } from '@/theme/tokens';

type Variant = keyof typeof typography;

export function AppText({ variant = 'body', muted, style, ...props }: TextProps & { variant?: Variant; muted?: boolean }) {
  return <Text style={[typography[variant], { color: muted ? colors.inkMuted : colors.ink }, style]} {...props} />;
}
