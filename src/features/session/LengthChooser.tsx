import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';
import { LENGTH_OPTIONS, lengthLabel, lengthSpoken, type LengthSec } from './customPattern';

// The session length: 2, 3, 5 or 10 minutes, as a row of pills. Used before a
// built-in session (session-player.tsx) and in the "Create your own" editor.
// Screen readers hear "Session length" and each choice as a radio button
// ("5 minutes, selected").
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
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{lengthLabel(sec)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
  },
  // Same look as the player's former duration badge; selected is filled.
  pill: {
    minHeight: spacing.base * 5,
    justifyContent: 'center',
    backgroundColor: 'rgba(10,16,40,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.base * 2,
    borderRadius: radii.full,
  },
  pillSelected: {
    backgroundColor: colors.inversePrimary,
    borderColor: colors.inversePrimary,
  },
  label: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  labelSelected: {
    color: '#ffffff',
  },
});
