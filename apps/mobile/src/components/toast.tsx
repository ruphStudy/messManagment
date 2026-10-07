import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme/tokens';
import { AppText } from './text';

type Tone = 'success' | 'error' | 'info';

interface ToastApi {
  show(message: string, tone?: Tone): void;
}

const Ctx = createContext<ToastApi | null>(null);

const toneColors: Record<Tone, string> = { success: colors.success, error: colors.danger, info: colors.ink };

/** Snackbar shown above the bottom safe area. One message at a time. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: Tone = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { bottom: insets.bottom + 72, backgroundColor: toneColors[toast.tone] }]}
        >
          <AppText style={styles.text}>{toast.message}</AppText>
        </View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: spacing.lg, right: spacing.lg, borderRadius: radius.control, padding: spacing.md + 2 },
  text: { color: '#fff', textAlign: 'center' },
});
