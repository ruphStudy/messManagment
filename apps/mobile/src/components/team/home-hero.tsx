import { StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed } from '@/theme/tokens';

/** Width the hero takes on the right; the greeting text keeps clear of it. */
export const HOME_HERO_WIDTH = 120;

/**
 * Decorative steaming bowl for the Home greeting (vector icons + shapes, no images). Theme tokens give the
 * peach/orange (Light), muted gold on navy (Dark) and lavender/violet (Purple) look. Not interactive.
 */
export function HomeHero() {
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.wrap}>
      <View style={styles.blobLarge} />
      <View style={styles.blobSmall} />
      <View style={styles.steam}>
        <View style={[styles.wisp, { height: 16, marginTop: 6 }]} />
        <View style={[styles.wisp, { height: 22 }]} />
        <View style={[styles.wisp, { height: 14, marginTop: 8 }]} />
      </View>
      <MaterialCommunityIcons name="bowl-mix-outline" size={58} color={colors.brand500} style={styles.bowl} />
      <Ionicons name="leaf" size={14} color={colors.success} style={styles.leaf} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { position: 'absolute', right: -8, top: -14, width: HOME_HERO_WIDTH, height: 104, opacity: 0.9 },
  blobLarge: { position: 'absolute', right: 0, top: 10, width: 104, height: 84, borderRadius: 42, backgroundColor: colors.brand50, transform: [{ rotate: '-12deg' }] },
  blobSmall: { position: 'absolute', left: 4, bottom: 4, width: 36, height: 28, borderRadius: 14, backgroundColor: colors.brand100, opacity: 0.7 },
  steam: { position: 'absolute', left: 50, top: 6, flexDirection: 'row', gap: 6 },
  wisp: { width: 3, borderRadius: 2, backgroundColor: colors.brand500, opacity: 0.45 },
  bowl: { position: 'absolute', left: 32, top: 34, opacity: 0.85 },
  leaf: { position: 'absolute', left: 18, top: 46, opacity: 0.7, transform: [{ rotate: '-30deg' }] },
  dot: { position: 'absolute', right: 14, top: 26, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand500, opacity: 0.5 },
}));
