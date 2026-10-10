/**
 * MessMate palettes (design-references/MessMateThemes). Same semantic names in every theme; components read
 * these instead of checking the theme. `brand*` = primary (orange in Light/Dark, violet in Purple).
 * Semantic states (danger/success/warning/info) stay red/green/amber/blue in every theme.
 */
const light = {
  brand50: '#fff4ec',
  brand100: '#ffe7d6',
  brand500: '#f97316',
  brand600: '#ea580c',
  brand700: '#c2410c',
  /** Screen background: warm off-white. */
  canvas: '#fbf8f5',
  /** Cards, inputs, tab bar. */
  surface: '#ffffff',
  /** Raised/highlighted surfaces (hero, selected rows). */
  surfaceElevated: '#ffffff',
  border: '#efe6dd',
  ink: '#16213e',
  inkMuted: '#6b7280',
  placeholder: '#a3a3a3',
  /** Soft tinted icon tiles. */
  iconBg: '#fff1e6',
  tabActive: '#ea580c',
  tabInactive: '#7b8190',
  /** Soft pill behind the active tab. */
  tabActiveBg: '#fff0e5',
  shadow: '#7c5a3a',
  success: '#16a34a',
  successSoft: '#dcfce7',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fde8e8',
  /** Banner surface for blocking notices (subscription, suspension). */
  dangerBanner: '#fdecec',
  info: '#2563eb',
  infoSoft: '#dbeafe',
  disabled: '#fed7aa',
};
export type Palette = typeof light;

/** Deep navy with slate-blue surfaces and an orange/gold accent (no pure black, restrained glow). */
const dark: Palette = {
  brand50: '#2a1a10',
  brand100: '#3a2414',
  brand500: '#fbbf24',
  brand600: '#f59e0b',
  brand700: '#fbbf6a',
  canvas: '#0b1430',
  surface: '#16243f',
  surfaceElevated: '#1c2d50',
  border: '#2c3f66',
  ink: '#eef2fb',
  inkMuted: '#9aa8c7',
  placeholder: '#64748b',
  iconBg: '#22345c',
  tabActive: '#fbae2d',
  tabInactive: '#8d9bbb',
  tabActiveBg: 'rgba(251, 174, 45, 0.14)',
  shadow: '#02060f',
  success: '#4ade80',
  successSoft: '#123b2a',
  warning: '#fbbf24',
  warningSoft: '#3d2e0c',
  danger: '#f87171',
  dangerSoft: '#3f1420',
  dangerBanner: '#3a1518',
  info: '#60a5fa',
  infoSoft: '#172554',
  disabled: '#6b4a1a',
};

/** Fixed MessMate Purple (the "System" option): lavender canvas, white cards, violet primary, deep-violet text. */
const purple: Palette = {
  brand50: '#f6f1ff',
  brand100: '#ede4ff',
  brand500: '#8b5cf6',
  brand600: '#7c3aed',
  brand700: '#6d28d9',
  canvas: '#f6f3fe',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  border: '#e8e1fa',
  ink: '#1f1147',
  inkMuted: '#6c6690',
  placeholder: '#a39dc0',
  iconBg: '#f0e9ff',
  tabActive: '#6d28d9',
  tabInactive: '#6c6690',
  tabActiveBg: '#ede4ff',
  shadow: '#5b3fb0',
  success: '#16a34a',
  successSoft: '#dcfce7',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  danger: '#e11d48',
  dangerSoft: '#ffe4ec',
  dangerBanner: '#fdeef5',
  info: '#2563eb',
  infoSoft: '#e0e7ff',
  disabled: '#d9c8fb',
};

export type Scheme = 'light' | 'dark' | 'purple';
const PALETTES: Record<Scheme, Palette> = { light, dark, purple };

let scheme: Scheme = 'light';
/** Called by ThemeProvider only. */
export function setActiveScheme(next: Scheme) {
  scheme = next;
}
export const activeScheme = () => scheme;

/** Soft elevation for cards/tiles (iOS shadow + Android elevation), tinted per theme. */
export const elevation = (level: 1 | 2 = 1) => ({
  shadowColor: PALETTES[scheme].shadow,
  shadowOpacity: scheme === 'dark' ? 0.35 : 0.06 * level,
  shadowRadius: 8 * level,
  shadowOffset: { width: 0, height: 2 * level },
  elevation: level * 2,
});

/**
 * Semantic colours for the active theme. Read at render time (each property is a getter), so components
 * pick up the current theme when they render; module-level style objects use `themed()` below.
 */
export const colors = Object.defineProperties(
  {} as Readonly<Palette>,
  Object.fromEntries((Object.keys(light) as (keyof Palette)[]).map((k) => [k, { get: () => PALETTES[scheme][k], enumerable: true }])),
);

/**
 * Lazily built, per-theme module-level styles/colour maps: `const styles = themed(() => StyleSheet.create({...}))`.
 * Rebuilt once when the theme changes; property access always returns the current theme's value.
 */
export function themed<T extends object>(factory: () => T): T {
  let cache: { scheme: Scheme; value: T } | null = null;
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

export const radius = { control: 12, card: 18, pill: 999 } as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

/** Minimum touch target (Android/iOS accessibility guidance). */
export const TOUCH_TARGET = 48;
