/** Design tokens mirrored from the web theme so both apps feel the same. */
export const colors = {
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
} as const;

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
