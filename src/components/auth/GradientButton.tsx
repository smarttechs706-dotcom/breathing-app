import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  running?: boolean;
  disabled?: boolean;
}

// Same gradient and white text as Onboarding's primary button, which keeps
// >=6.47:1 contrast across the gradient (see AUDIT-2.md). A disabled button is
// flat rather than faded: a cooldown label is information people need to read.
export function GradientButton({ label, onPress, running = false, disabled = false }: GradientButtonProps) {
  const blocked = running || disabled;
  const waiting = disabled && !running;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: running }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        running && styles.running,
      ]}
    >
      <LinearGradient
        colors={
          waiting
            ? [colors.surfaceContainerHigh, colors.surfaceContainerHigh]
            : [colors.inversePrimary, colors.onPrimaryFixedVariant]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {running ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={[styles.label, waiting && styles.waitingLabel]}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    borderRadius: radii.full,
  },
  pressed: {
    opacity: 0.85,
  },
  running: {
    opacity: 0.6,
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: spacing.base * 2,
    borderRadius: radii.full,
  },
  label: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  waitingLabel: {
    color: colors.onSurfaceVariant,
  },
});
