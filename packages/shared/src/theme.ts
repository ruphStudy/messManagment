/** Appearance preference, stored only on the device/browser (never on the account). Default: light. */
export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];
export const THEME_LABELS: Record<ThemePreference, string> = { light: 'Light', dark: 'Dark', system: 'System' };
export const DEFAULT_THEME: ThemePreference = 'light';
export const THEME_STORAGE_KEY = 'mm.theme';

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** The scheme actually shown. */
export function resolveTheme(pref: ThemePreference, systemIsDark: boolean): 'light' | 'dark' {
  return pref === 'system' ? (systemIsDark ? 'dark' : 'light') : pref;
}
