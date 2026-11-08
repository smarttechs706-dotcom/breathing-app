import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import {
  DRIFT_HALF_MS,
  DRIFT_MAX_SCALE,
  DRIFT_MIN_SCALE,
  DRIFT_SHIFT_X,
  driftTranslateY,
  SHIMMER_HEIGHT,
  SHIMMER_LOOP_MS,
  SHIMMER_OFFSET,
  SHIMMER_PEAK_OPACITY,
  SHIMMER_WIDTH_SHARE,
  twinkleCurve,
  twinkleStars,
  TWINKLE_LOOP_MS,
  type Frame,
} from './ambient';
import { EASE_IN_OUT_SINE } from './motion';

// Ambient background motion. Every loop uses the native driver, runs only
// while `running` (see useAmbientMotion) and, when paused, holds where it is
// and later resumes from there, so nothing jumps.

// Linear 0 -> 1 loop. Values 0 and 1 must look the same (offscreen, or the
// same point of a periodic curve), so the restart is invisible.
// Also used by PreviewOrb's moving light.
export function useCycle(value: Animated.Value, running: boolean, durationMs: number) {
  const last = useRef(0);
  useEffect(() => {
    if (!running) return;
    const anim = Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: (1 - last.current) * durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]);
    anim.start();
    return () => {
      anim.stop();
      value.stopAnimation((v) => {
        last.current = v;
      });
    };
  }, [value, running, durationMs]);
}

// 0 -> 1 -> 0 loop with sine easing; on resume it first eases back to 0.
// Also used by PreviewOrb's breathing.
export function usePingPong(value: Animated.Value, running: boolean, halfMs: number) {
  const last = useRef(0);
  useEffect(() => {
    if (!running) return;
    const leg = (toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, easing: EASE_IN_OUT_SINE, useNativeDriver: true });
    const anim = Animated.sequence([
      leg(0, last.current * halfMs),
      Animated.loop(Animated.sequence([leg(1, halfMs), leg(0, halfMs)])),
    ]);
    anim.start();
    return () => {
      anim.stop();
      value.stopAnimation((v) => {
        last.current = v;
      });
    };
  }, [value, running, halfMs]);
}

// A. The painting, shown at 1.06-1.08x and drifting ±4 dp sideways over 50 s.
// The vertical shift keeps the horizon on the same row at every scale.
export function DriftingPainting({
  source,
  frame,
  horizonY,
  running,
}: {
  source: ImageSourcePropType;
  frame: Frame;
  horizonY: number;
  running: boolean;
}) {
  const drift = useRef(new Animated.Value(0)).current;
  usePingPong(drift, running, DRIFT_HALF_MS);

  const scale = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [DRIFT_MIN_SCALE, DRIFT_MAX_SCALE],
  });
  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [
      driftTranslateY(frame, horizonY, DRIFT_MIN_SCALE),
      driftTranslateY(frame, horizonY, DRIFT_MAX_SCALE),
    ],
  });
  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRIFT_SHIFT_X, DRIFT_SHIFT_X],
  });

  return (
    <Animated.Image
      source={source}
      style={{
        position: 'absolute',
        top: frame.top,
        left: frame.left,
        width: frame.width,
        height: frame.height,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

// B. Night only: small star dots in the side bands of sky, twinkling at
// different phases of one shared 9 s loop.
export function NightStars({ w, h, running }: { w: number; h: number; running: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useCycle(t, running, TWINKLE_LOOP_MS);
  const stars = useMemo(() => twinkleStars(), []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star, i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            {
              left: star.x * w - star.size / 2,
              top: star.y * h - star.size / 2,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: t.interpolate(twinkleCurve(star.phase)),
            },
          ]}
        />
      ))}
    </View>
  );
}

// C. A soft, faint band of light drifting across the water below the horizon.
export function WaterShimmer({ w, horizonY, running }: { w: number; horizonY: number; running: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useCycle(t, running, SHIMMER_LOOP_MS);
  const bandW = w * SHIMMER_WIDTH_SHARE;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [-bandW, w] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shimmer,
        {
          top: horizonY + SHIMMER_OFFSET,
          width: bandW,
          height: SHIMMER_HEIGHT,
          transform: [{ translateX }],
        },
      ]}
    >
      <Svg width={bandW} height={SHIMMER_HEIGHT}>
        <Defs>
          <RadialGradient id="shimmer" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={SHIMMER_PEAK_OPACITY} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={bandW / 2}
          cy={SHIMMER_HEIGHT / 2}
          rx={bandW / 2}
          ry={SHIMMER_HEIGHT / 2}
          fill="url(#shimmer)"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    backgroundColor: '#ffffff',
  },
  shimmer: {
    position: 'absolute',
    left: 0,
  },
});
