import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';

interface BreathingRingProps {
  inhaleSec: number;
  holdSec: number;
  exhaleSec: number;
  paused: boolean;
  size?: number;
}

// session-player-code.html's "Breathing Sphere Indicator": two pulsing
// outer rings + a gradient core sphere with a wind/breath icon, scaling up
// on inhale and back down on exhale, holding size during the hold phase.
//
// Icon note: the mockup uses the `air` glyph here — the same icon that
// rendered as the wrong glyph entirely on this user's physical Android
// device (font-version skew between @expo/vector-icons and Expo Go's
// bundled font, see app/(tabs)/_layout.tsx and PROGRESS.md). Using `waves`
// instead, consistent with the Player tab's fix, rather than reintroduce
// the same bug in a new place.
export function BreathingRing({
  inhaleSec,
  holdSec,
  exhaleSec,
  paused,
  size = 256,
}: BreathingRingProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (paused) return;

    const loop = () => {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: inhaleSec * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(holdSec * 1000),
        Animated.timing(scale, {
          toValue: 1,
          duration: exhaleSec * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) loop();
      });
    };
    loop();

    return () => {
      scale.stopAnimation();
    };
  }, [scale, inhaleSec, holdSec, exhaleSec, paused]);

  const coreSize = size * 0.625; // matches mockup's w-40 inside w-64 (160/256)

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: `${colors.primary}33`,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: (size * 0.85) / 2,
            borderColor: `${colors.tertiary}4D`,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View
        style={{ transform: [{ scale }] }}
      >
        <LinearGradient
          colors={[colors.primaryContainer, colors.tertiary]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[
            styles.core,
            { width: coreSize, height: coreSize, borderRadius: coreSize / 2 },
          ]}
        >
          <MaterialIcons name="waves" size={coreSize * 0.3} color="#ffffff" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
});
