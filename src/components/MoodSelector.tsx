import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/tokens';

// session-player-code.html's mood picker (used for both the pre-mood
// "How are you feeling?" row and the post-mood "After" row): 5 emoji
// buttons over a primary->tertiary gradient track, filled up to the
// selected position, with "Stressed"/"Calm" labels under the ends.
export const MOOD_EMOJIS = ['😫', '😟', '😐', '🙂', '😌'] as const;

// Word labels for each mood value, along the same Stressed<->Calm spectrum
// as this component's own end labels below. Not Stitch-sourced (no design
// reference specifies per-value words, only the two endpoints) — added for
// Home's "current mood" card, which needs a word alongside the emoji per
// architecture.md's spec. See PROGRESS.md.
export const MOOD_LABELS = ['Stressed', 'Uneasy', 'Neutral', 'Content', 'Calm'] as const;

export function MoodSelector({
  value,
  onChange,
  style,
}: {
  value: number; // 1-5
  onChange: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const filledPercent = ((value - 1) / (MOOD_EMOJIS.length - 1)) * 100;

  return (
    <View style={style}>
      <View style={styles.track}>
        <View style={styles.trackBase} />
        <LinearGradient
          colors={[colors.primary, colors.tertiary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.trackFill, { width: `${filledPercent}%` }]}
        />
        <View style={styles.row}>
          {MOOD_EMOJIS.map((emoji, index) => {
            const moodValue = index + 1;
            const selected = moodValue === value;
            return (
              <Pressable
                key={moodValue}
                onPress={() => onChange(moodValue)}
                style={[styles.bubble, selected && styles.bubbleSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Mood ${moodValue} of ${MOOD_EMOJIS.length}`}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Stressed</Text>
        <Text style={styles.label}>Calm</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    paddingVertical: spacing.base,
  },
  trackBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceVariant,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: radii.full,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 2,
    borderColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
    transform: [{ scale: 1.1 }],
  },
  emoji: {
    fontSize: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.base,
  },
  label: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
  },
});
