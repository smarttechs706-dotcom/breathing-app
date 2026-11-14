import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../../theme/tokens';
import { accents, text } from '../home/styles';
import { MOOD_LEVELS, moodLevel } from './sessionModel';

// The session player's mood picker: a 1-5 scale from stressed to calm on a
// track that fills up to the chosen level. Each level is an emoji face
// (sessionModel.MOOD_LEVELS), a deliberate exception to the app's no-emoji
// rule for this component only, at the user's request (2026-11-15). On
// screen only the two ends are labelled ("Stressed", "Calm"); screen readers
// hear each level's word. After a choice, a small caption under the scale
// names the chosen level. Selected: solid blue circle. Nothing animates.

export function MoodScale({
  value,
  onChange,
  style,
}: {
  value: number | null; // 1-5, or null = nothing chosen yet (D-10)
  onChange: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const filledPercent = value === null ? 0 : ((value - 1) / (MOOD_LEVELS.length - 1)) * 100;
  const chosen = moodLevel(value);

  return (
    <View style={style}>
      <View style={styles.track} accessibilityRole="radiogroup">
        <View style={styles.trackBase} />
        <LinearGradient
          colors={[colors.primary, colors.tertiary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.trackFill, { width: `${filledPercent}%` }]}
        />
        <View style={styles.row}>
          {MOOD_LEVELS.map((level) => {
            const selected = level.value === value;
            return (
              <Pressable
                key={level.value}
                onPress={() => onChange(level.value)}
                style={[styles.bubble, selected && styles.bubbleSelected]}
                // 40 dp circle + 4 dp each side = 48 dp touch target.
                hitSlop={4}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${level.word}, ${level.value} of ${MOOD_LEVELS.length}`}
              >
                <Text style={styles.emoji} accessible={false} importantForAccessibility="no">
                  {level.emoji}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Stressed</Text>
        <Text style={styles.label}>Calm</Text>
      </View>
      {/* The chosen level's name. The line is always there (empty until a
          choice) so nothing below it moves when it appears. */}
      <Text
        style={styles.caption}
        accessibilityLiveRegion="polite"
        accessibilityElementsHidden={chosen === null}
        importantForAccessibility={chosen === null ? 'no-hide-descendants' : 'auto'}
      >
        {chosen?.word ?? ''}
      </Text>
    </View>
  );
}

// A mood shown on its own (Session Complete's Before -> After row): the
// level's emoji, or a plain hyphen when no mood has been chosen yet.
export function MoodGlyph({ mood, size, color }: { mood: number | null; size: number; color: string }) {
  const level = moodLevel(mood);
  if (level === null) {
    return (
      <Text
        style={[styles.dash, { fontSize: size * 0.8, lineHeight: size, color }]}
        accessibilityLabel="No mood chosen"
      >
        -
      </Text>
    );
  }
  return (
    <Text style={[styles.emoji, { fontSize: size * 0.9, lineHeight: size }]} accessibilityLabel={level.word}>
      {level.emoji}
    </Text>
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
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: '#141c3a',
    borderWidth: 1,
    borderColor: accents.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleSelected: {
    backgroundColor: colors.inversePrimary,
    borderColor: colors.inversePrimary,
  },
  // Emoji are drawn by the phone's emoji font; only the size is set here.
  emoji: {
    ...text.body,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.base,
  },
  label: {
    ...text.meta,
    color: colors.onSurfaceVariant,
  },
  caption: {
    ...text.meta,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: spacing.base,
  },
  dash: {
    ...text.body,
  },
});
