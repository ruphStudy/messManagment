import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DEFAULT_THEME, isThemePreference, THEME_STORAGE_KEY, type ThemePreference } from '@mess/shared';
import { colors, setActiveScheme, type Scheme } from './tokens';

/** Mobile: the stored `system` value means the fixed MessMate Purple theme (it no longer follows the phone). */
const SCHEME_FOR: Record<ThemePreference, Scheme> = { light: 'light', dark: 'dark', system: 'purple' };

interface ThemeState {
  preference: ThemePreference;
  resolved: Scheme;
  setPreference(p: ThemePreference): void;
}

const Ctx = createContext<ThemeState | null>(null);

/**
 * One theme for every mobile area (auth, student, team). The preference lives on this device only.
 * On a theme switch the screen tree is re-rendered with the new palette and the current screen is reopened.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference | null>(null);
  const resolved = SCHEME_FOR[preference ?? DEFAULT_THEME];
  // Before children render, so every `colors.x` read during this render uses the right palette.
  setActiveScheme(resolved);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY)
      .then((v) => setPref(isThemePreference(v) ? v : DEFAULT_THEME))
      .catch(() => setPref(DEFAULT_THEME));
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    void SecureStore.setItemAsync(THEME_STORAGE_KEY, p).catch(() => undefined);
  }, []);

  // Remount on scheme change (module-level styles are rebuilt per theme), then return to the same screen.
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const route = useRef({ pathname, params });
  route.current = { pathname, params };
  const reopen = useRef<typeof route.current | null>(null);
  const lastScheme = useRef(resolved);
  if (lastScheme.current !== resolved) {
    lastScheme.current = resolved;
    reopen.current = route.current;
  }
  useEffect(() => {
    const target = reopen.current;
    if (!target) return;
    reopen.current = null;
    setTimeout(() => router.replace({ pathname: target.pathname as never, params: target.params }), 0);
  }, [resolved]);

  const navTheme = useMemo(() => {
    const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: colors.brand600, background: colors.canvas, card: colors.canvas, text: colors.ink, border: colors.border, notification: colors.danger } };
  }, [resolved]);

  const value = useMemo(() => ({ preference: preference ?? DEFAULT_THEME, resolved, setPreference }), [preference, resolved, setPreference]);
  if (!preference) return null; // brief: avoids a light flash before the saved theme is read

  return (
    <Ctx.Provider value={value}>
      <NavigationThemeProvider value={navTheme}>
        <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
        {children}
      </NavigationThemeProvider>
    </Ctx.Provider>
  );
}

/**
 * Re-mounts the screens (not auth/session or toasts) when the scheme changes, so module-level styles built
 * for the old palette are rebuilt. Place inside AuthProvider to keep the signed-in session.
 */
export function ThemedTree({ children }: { children: ReactNode }) {
  const { resolved } = useAppTheme();
  return <ThemedTreeInner key={resolved}>{children}</ThemedTreeInner>;
}
function ThemedTreeInner({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAppTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return ctx;
}
