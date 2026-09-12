import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { colors } from '../theme/tokens';

// Placeholder for the Stitch hero image (a hotlinked Google-hosted asset we
// don't own/control) and for DESIGN.md's "Floating Breath Indicator"
// component ("a large, central sphere that pulses with a soft glow").
// Flagging: this is a programmatic stand-in, not a real illustration asset —
// swap for real artwork/Lottie when one exists.
export function BreathOrb({ size = 192 }: { size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return (
    <Animated.View
      style={[
        styles.container,
        { width: size, height: size, transform: [{ scale }] },
      ]}
    >
      <LinearGradient
        colors={[colors.primary, colors.tertiary]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    opacity: 0.85,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
});
