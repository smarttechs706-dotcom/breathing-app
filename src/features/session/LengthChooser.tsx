import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';
import { LENGTH_OPTIONS, lengthLabel, lengthLabelSpoken, lengthSpoken, type LengthSec } from './customPattern';

// The session length: 2, 3, 5 or 10 minutes, as one row of four pills of equal
// width. Used before a built-in session (session-player.tsx) and in the
// "Create your own" editor. Screen readers hear "Session length" and each
// choice as a radio button ("5 minutes, selected").
//
// One row on every phone: each pill takes a quarter of the row (flex: 1) and
// never wraps to a second row. At 360 dp in the player a pill is 59.5 dp wide,
// with 49.5 dp for its label; "10 min" (40 dp) fits on one line up to a 1.15x
// system font size. Larger, a label breaks between its words inside its own
// pill and the four pills grow to the same height; the longest word, "min",
// still fits at 2x (45.6 dp).
export function LengthChooser({
  value,
  onChange,
}: {
  value: LengthSec;
  onChange: (sec: LengthSec) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Session length">
      {LENGTH_OPTIONS.map((sec) => {
        const selected = sec === value;
        return (
          <Pressable
            key={sec}
            onPress={() => onChange(sec)}
            accessibilityRole="radio"
            accessibilityLabel={lengthSpoken(sec)}
            accessibilityState={{ selected, checked: selected }}
            hitSlop={4}
            style={[styles.pill, styles.choice, selected && styles.pillSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{lengthLabel(sec)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A custom session's length before it starts: chosen in the editor, so only
// shown, not changeable. Same look as an unselected pill; screen readers hear
// "Session length, 5 minutes".
export function LengthLabel({ value }: { value: LengthSec }) {
  return (
    <View
      style={[styles.pill, styles.badge]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={lengthLabelSpoken(value)}
    >
      <Text style={styles.label}>{lengthLabel(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  // Same look as the player's former duration badge; selected is filled.
  pill: {
    minHeight: spacing.base * 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,16,40,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.full,
  },
  // A quarter of the row each.
  choice: {
    flex: 1,
    paddingHorizontal: spacing.base * 0.5,
    paddingVertical: spacing.base * 0.5,
  },
  // Sized to its text, where the badge used to be.
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.base * 2,
  },
  pillSelected: {
    backgroundColor: colors.inversePrimary,
    borderColor: colors.inversePrimary,
  },
  label: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  labelSelected: {
    color: '#ffffff',
  },
});
