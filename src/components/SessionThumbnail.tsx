import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { colors, radii } from '../theme/tokens';
import type { Session } from '../types/models';

// Placeholder for library-code.html's per-session hotlinked illustration
// thumbnails (Google-hosted images we don't own) — same approach as Home's
// BreathOrb. A per-pattern gradient stands in until real artwork exists.
const PATTERN_GRADIENTS: Record<Session['pattern'], [string, string]> = {
  rings: [colors.primary, colors.tertiary],
  wave: [colors.secondary, colors.primary],
  starburst: [colors.tertiary, colors.secondary],
  'dot-grid': [colors.primaryContainer, colors.tertiary],
  spiral: [colors.secondary, colors.tertiaryContainer],
  bloom: [colors.primary, colors.secondaryContainer],
};

export function SessionThumbnail({
  pattern,
  size = 80,
}: {
  pattern: Session['pattern'];
  size?: number;
}) {
  return (
    <LinearGradient
      colors={PATTERN_GRADIENTS[pattern]}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
      style={[
        styles.thumbnail,
        { width: size, height: size, borderRadius: radii.xl },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    opacity: 0.85,
  },
});
