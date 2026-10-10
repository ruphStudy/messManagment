import { colors, elevation } from './tokens';

/** Header + bottom tab styling shared by the student and team apps (per-theme via tokens). */
export const tabScreenOptions = () => ({
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.canvas },
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18, color: colors.ink },
  headerTitleAlign: 'center' as const,
  tabBarActiveTintColor: colors.tabActive,
  tabBarInactiveTintColor: colors.tabInactive,
  // Soft tinted pill behind the active tab (lavender in Purple, faint orange/gold in Light/Dark).
  tabBarActiveBackgroundColor: colors.tabActiveBg,
  tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2, marginVertical: 5, paddingHorizontal: 0 },
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 70, paddingTop: 2, paddingHorizontal: 4, ...elevation(2) },
  // Smaller, non-scaling labels so "Attendance" fits on narrow phones.
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const, letterSpacing: -0.1 },
  tabBarAllowFontScaling: false,
});
