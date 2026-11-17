import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';

// The app's pill switch, drawn only: the same look as the Daily reminder
// toggle (app/reminder.tsx). Track 48x28, thumb 20x20, 20 px travel. Off: a
// light thumb on a faint track. On: a white thumb on a solid blue track.
// It is not focusable by itself: the row around it is the screen reader's
// switch (accessibilityRole="switch" with its checked state) and takes the
// tap, so the whole row toggles.
export function PillSwitch({ value }: { value: boolean }) {
  return (
    <View style={styles.track} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[StyleSheet.absoluteFill, value ? styles.trackOn : styles.trackOff]} />
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackOff: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  trackOn: {
    borderRadius: 14,
    backgroundColor: colors.inversePrimary,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.onSurfaceVariant,
    transform: [{ translateX: 0 }],
  },
  thumbOn: {
    backgroundColor: '#ffffff',
    transform: [{ translateX: 20 }],
  },
});
