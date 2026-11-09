import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../theme/tokens';
import { useReducedMotion } from '../home/motion';

// The breathing screen's circle: a solid indigo-to-navy centre holding the
// phase word, soft periwinkle halo rings that grow and shrink with the breath,
// and one thin fixed outer ring. The halos use the same 1 -> 1.15 scale and
// the same phase timings as src/components/BreathingRing.tsx (which stays as
// it is). With reduced motion the halos stay still; only the word changes.

// All colours in one place for quick tuning. Taken from the token range
// inversePrimary (#3c55bf) -> onPrimaryFixedVariant (#1f3ba6) -> onPrimaryFixed
// (#001356); halos and rim from primaryFixedDim / primaryFixed (periwinkle).
export const CIRCLE_COLORS = {
  centre: [colors.inversePrimary, colors.onPrimaryFixedVariant, colors.onPrimaryFixed] as const,
  rim: 'rgba(221,225,255,0.35)',
  // Each halo disc is this translucent; stacked, the bands read about 5-25%.
  halo: 'rgba(185,195,255,0.055)',
  outerRing: 'rgba(255,255,255,0.2)',
  word: '#ffffff',
};

const SIZE = 300; // outer ring diameter, dp
const CENTRE = 0.47; // centre circle, fraction of SIZE
const HALOS = [0.82, 0.76, 0.7, 0.64, 0.58, 0.52]; // halo discs, outermost first
const BREATH_SCALE = 1.15;

// "BREATHE IN" -> "Breathe in"
function sentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

export function BreathCircle({
  label,
  inhaleSec,
  holdSec,
  exhaleSec,
  restSec,
  paused,
}: {
  label: string;
  inhaleSec: number;
  holdSec: number;
  exhaleSec: number;
  restSec: number;
  paused: boolean;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  // Same loop as BreathingRing: grow over the inhale, hold, shrink over the
  // exhale, rest. Stopped while paused or with reduced motion.
  useEffect(() => {
    if (paused || reduced !== false) {
      if (reduced !== false) scale.setValue(1);
      return;
    }
    const loop = () => {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: BREATH_SCALE,
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
        Animated.delay(restSec * 1000),
      ]).start(({ finished }) => {
        if (finished) loop();
      });
    };
    loop();
    return () => scale.stopAnimation();
  }, [scale, inhaleSec, holdSec, exhaleSec, restSec, paused, reduced]);

  const centre = SIZE * CENTRE;

  return (
    <View style={styles.container}>
      <View style={styles.outerRing} />
      {HALOS.map((f) => (
        <Animated.View
          key={f}
          style={[
            styles.halo,
            { width: SIZE * f, height: SIZE * f, borderRadius: (SIZE * f) / 2, transform: [{ scale }] },
          ]}
        />
      ))}
      <LinearGradient
        colors={CIRCLE_COLORS.centre}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.centre, { width: centre, height: centre, borderRadius: centre / 2 }]}
      >
        <Text style={styles.word} numberOfLines={1} adjustsFontSizeToFit>
          {sentenceCase(label)}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: CIRCLE_COLORS.outerRing,
  },
  halo: {
    position: 'absolute',
    backgroundColor: CIRCLE_COLORS.halo,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: CIRCLE_COLORS.rim,
  },
  word: {
    ...typography.headlineLgMobile,
    fontSize: 20,
    lineHeight: 26,
    color: CIRCLE_COLORS.word,
  },
});
