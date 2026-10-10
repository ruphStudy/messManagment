/** Design tokens mirrored from the web theme so both apps feel the same. */
const light = {
  brand50: '#fff7ed',
  brand100: '#ffedd5',
  brand500: '#f97316',
  brand600: '#ea580c',
  brand700: '#c2410c',
  surface: '#ffffff',
  canvas: '#f8fafc',
  border: '#e2e8f0',
  ink: '#0f172a',
  inkMuted: '#64748b',
  placeholder: '#94a3b8',
  success: '#16a34a',
  successSoft: '#dcfce7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  info: '#2563eb',
  infoSoft: '#dbeafe',
  disabled: '#fed7aa',
};
export type Palette = typeof light;

/** Dark palette: same semantic names; soft slate surfaces (not pure black). */
const dark: Palette = {
  brand50: '#2a1a0e',
  brand100: '#3b230f',
  brand500: '#fb923c',
  brand600: '#f97316',
  brand700: '#fdba74',
  surface: '#1e293b',
  canvas: '#0f172a',
  border: '#334155',
  ink: '#f1f5f9',
  inkMuted: '#94a3b8',
  placeholder: '#64748b',
  success: '#4ade80',
  successSoft: '#14532d',
  danger: '#f87171',
  dangerSoft: '#450a0a',
  info: '#60a5fa',
  infoSoft: '#172554',
  disabled: '#7c3a12',
};

let scheme: 'light' | 'dark' = 'light';
/** Called by ThemeProvider only. */
export function setActiveScheme(next: 'light' | 'dark') {
  scheme = next;
}
export const activeScheme = () => scheme;

/**
 * Semantic colours for the active theme. Read at render time (each property is a getter), so components
 * pick up the current theme when they render; module-level style objects use `themed()` below.
 */
export const colors = Object.defineProperties(
  {} as Readonly<Palette>,
  Object.fromEntries((Object.keys(light) as (keyof Palette)[]).map((k) => [k, { get: () => (scheme === 'dark' ? dark : light)[k], enumerable: true }])),
);

/**
 * Lazily built, per-theme module-level styles/colour maps: `const styles = themed(() => StyleSheet.create({...}))`.
 * Rebuilt once when the theme changes; property access always returns the current theme's value.
 */
export function themed<T extends object>(factory: () => T): T {
  let cache: { scheme: 'light' | 'dark'; value: T } | null = null;
  const current = () => {
    if (!cache || cache.scheme !== scheme) cache = { scheme, value: factory() };
    return cache.value;
  };
  return new Proxy({} as T, {
    get: (_t, key) => current()[key as keyof T],
    has: (_t, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_t, key) => Object.getOwnPropertyDescriptor(current(), key),
  });
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { control: 10, card: 16, pill: 999 } as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

/** Minimum touch target (Android/iOS accessibility guidance). */
export const TOUCH_TARGET = 48;
