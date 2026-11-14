import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../theme/tokens';
import { useReducedMotion } from '../home/motion';
import type { BreathPhase } from './breathPattern';

// The breathing screen's circle: a solid indigo-to-navy centre holding the
// phase word, soft periwinkle halo rings that grow and shrink with the breath,
// and one thin fixed outer ring. The halos use the same 1 -> 1.15 scale as
// src/components/BreathingRing.tsx (which stays as it is). The circle has no
// clock of its own: the session player's one clock tells it which phase it is
// in and how far through (breathPattern.breathAt), and it grows over the
// in-breath, shrinks over the out-breath and holds still otherwise, for the
// time left in that phase. So the word, the line under it, the circle and the
// session end can never drift apart, also across pause and resume. With
// reduced motion the halos stay still; only the word changes.

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
  phase,
  step,
  phaseElapsedMs,
  phaseDurationMs,
  paused,
}: {
  label: string;
  phase: BreathPhase;
  // Changes exactly when the phase changes (breathPattern.breathAt).
  step: number;
  phaseElapsedMs: number;
  phaseDurationMs: number;
  paused: boolean;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  // Read when a phase starts or the session resumes, not on every tick.
  const timing = useRef({ phaseElapsedMs, phaseDurationMs });
  timing.current = { phaseElapsedMs, phaseDurationMs };

  // Grow over the in-breath and shrink over the out-breath, for the time left
  // in the phase; hold still during a hold or rest. Stopped while paused (the
  // circle stays where it was) and still with reduced motion.
  useEffect(() => {
    if (reduced !== false) {
      scale.setValue(1);
      return;
    }
    if (paused || (phase !== 'inhale' && phase !== 'exhale')) return;
    const left = Math.max(0, timing.current.phaseDurationMs - timing.current.phaseElapsedMs);
    const anim = Animated.timing(scale, {
      toValue: phase === 'inhale' ? BREATH_SCALE : 1,
      duration: left,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [scale, phase, step, paused, reduced]);

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
