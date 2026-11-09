import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MOOD_LABELS } from '../../components/MoodSelector';
import { colors, radii, spacing } from '../../theme/tokens';
import { accents, text } from '../home/styles';
import { MOOD_ICONS, moodIcon } from './sessionModel';

// The session player's mood picker: the same 1-5 scale, track, labels and
// accessibility as src/components/MoodSelector.tsx (which stays as it is), with
// weather icons instead of emoji. Selected: solid blue circle, white filled
// icon. Not selected: glass circle, muted outline icon.

type IconName = keyof typeof Ionicons.glyphMap;

export function MoodScale({
  value,
  onChange,
  style,
}: {
  value: number | null; // 1-5, or null = nothing chosen yet (D-10)
  onChange: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const filledPercent = value === null ? 0 : ((value - 1) / (MOOD_ICONS.length - 1)) * 100;

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
          {MOOD_ICONS.map((icon, index) => {
            const moodValue = index + 1;
            const selected = moodValue === value;
            return (
              <Pressable
                key={moodValue}
                onPress={() => onChange(moodValue)}
                style={[styles.bubble, selected && styles.bubbleSelected]}
                // 40 dp circle + 4 dp each side = 48 dp touch target.
                hitSlop={4}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${MOOD_LABELS[index]}, ${moodValue} of ${MOOD_ICONS.length}`}
              >
                <Ionicons
                  name={(selected ? icon.filled : icon.outline) as IconName}
                  size={20}
                  color={selected ? '#ffffff' : colors.onSurfaceVariant}
                />
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

// A mood shown on its own (Session Complete's Before -> After row): the outline
// weather icon, or a dash when no mood has been chosen yet.
export function MoodGlyph({ mood, size, color }: { mood: number | null; size: number; color: string }) {
  const name = moodIcon(mood, 'outline');
  if (name === null) {
    return <Text style={[styles.dash, { fontSize: size * 0.8, lineHeight: size, color }]}>–</Text>;
  }
  return <Ionicons name={name as IconName} size={size} color={color} />;
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.base,
  },
  label: {
    ...text.meta,
    color: colors.onSurfaceVariant,
  },
  dash: {
    ...text.body,
  },
});
