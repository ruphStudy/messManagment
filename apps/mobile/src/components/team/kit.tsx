import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, TOUCH_TARGET, themed } from '@/theme/tokens';
import { Avatar } from '../avatar';
import { Card } from '../layout';
import { AppText } from '../text';

type Tone = 'success' | 'danger' | 'info' | 'brand' | 'neutral';
const TONES: Record<Tone, { bg: string; fg: string }> = themed(() => ({
  success: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  brand: { bg: colors.brand100, fg: colors.brand700 },
  neutral: { bg: colors.canvas, fg: colors.inkMuted },
}));

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.pill, { backgroundColor: TONES[tone].bg }]}>
      <AppText variant="caption" style={{ color: TONES[tone].fg, fontWeight: '600' }}>{label}</AppText>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText muted style={{ flex: 1 }}>{label}</AppText>
      {typeof value === 'string' || typeof value === 'number' ? <AppText style={styles.value}>{value}</AppText> : value}
    </View>
  );
}

/** Tappable list row (≥ 48 pt). */
export function ListItem({ title, subtitle, right, onPress, icon, muted, avatar }: { title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; icon?: ComponentProps<typeof Ionicons>['name']; muted?: boolean; /** Person name → initials circle (instead of an icon). */ avatar?: string }) {
  const body = (
    <Card style={styles.item}>
      {avatar !== undefined ? <Avatar name={avatar} /> : icon && <Ionicons name={icon} size={22} color={muted ? colors.placeholder : colors.brand600} />}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" style={[{ fontWeight: '600' }, muted && { color: colors.inkMuted, textDecorationLine: 'line-through' }]}>{title}</AppText>
        {subtitle ? <AppText variant="caption" muted>{subtitle}</AppText> : null}
      </View>
      {right}
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />}
    </Card>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>{body}</Pressable> : body;
}

/** Single- or multi-select chips. */
export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | T[] | null; onChange: (v: T) => void }) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: selected(o.value) }} style={[styles.chip, selected(o.value) && styles.chipOn]}>
          <AppText style={[{ fontWeight: '600', fontSize: 14 }, selected(o.value) && { color: '#fff' }]}>{o.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={colors.inkMuted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.placeholder} style={{ flex: 1, fontSize: 16, minHeight: TOUCH_TARGET - 4, color: colors.ink }} accessibilityLabel={placeholder} autoCapitalize="none" />
    </View>
  );
}

export function MultilineInput({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder: string; maxLength?: number }) {
  return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.placeholder} maxLength={maxLength} multiline style={styles.multi} accessibilityLabel={placeholder} />;
}

/** Number tiles (dashboard, summaries). */
export function Stats({ items }: { items: { label: string; value: string | number; tone?: 'danger' | 'success' }[] }) {
  return (
    <View style={styles.stats}>
      {items.map((s) => (
        <View key={s.label} style={styles.stat}>
          <AppText variant="caption" muted>{s.label}</AppText>
          <AppText variant="title" style={s.tone ? { color: s.tone === 'danger' ? colors.danger : colors.success } : undefined}>{s.value}</AppText>
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <AppText variant="label" muted>{children.toUpperCase()}</AppText>;
}

const styles = themed(() => StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 2, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  value: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  multi: { minHeight: 96, color: colors.ink, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: spacing.md, fontSize: 16, textAlignVertical: 'top', backgroundColor: colors.surface },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { minWidth: '45%', flexGrow: 1, gap: 2 },
}));
