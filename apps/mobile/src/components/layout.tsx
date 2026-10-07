import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  /** Enables pull-to-refresh on scrolling screens. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** Safe-area aware screen container with keyboard handling. */
export function Screen({ children, scroll = true, edges = ['top', 'bottom'], onRefresh, refreshing = false }: ScreenProps) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.grow}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh && <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand600} />}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg + 4,
    gap: spacing.sm,
  },
});
