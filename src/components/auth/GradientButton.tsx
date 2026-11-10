import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';

// While waiting (cooldown): translucent navy glass, like the session player's
// disabled buttons.
const GLASS_FILL = 'rgba(10,16,40,0.55)';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  running?: boolean;
  disabled?: boolean;
}

// The app's primary button: inversePrimary to onPrimaryFixedVariant (the
// AUDIT-2 pair, white text >=6.47:1), white sentence-case label. A disabled button is
// glass rather than faded: a cooldown label is information people need to read.
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
            ? [GLASS_FILL, GLASS_FILL]
            : [colors.inversePrimary, colors.onPrimaryFixedVariant]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, waiting && styles.glass]}
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
  glass: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  label: {
    ...typography.headlineLgMobile,
    fontSize: 16,
    lineHeight: 24,
    color: '#ffffff',
  },
  waitingLabel: {
    color: 'rgba(255,255,255,0.6)',
  },
});
