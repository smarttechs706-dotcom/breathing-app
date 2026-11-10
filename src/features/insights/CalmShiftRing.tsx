import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { text } from '../home/styles';
import { useReducedMotion } from '../home/motion';
import { colors, typography } from '../../theme/tokens';
import { INSIGHT_COLORS } from './insightColors';

// The Calm shift ring: a faint track and a white arc filled from 0 to +4 (see
// insightsModel.calmShift), with the signed number in the middle. The arc
// draws in once; with reduced motion it is shown already drawn.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 184;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function CalmShiftRing({ fill, label, caption }: { fill: number; label: string; caption: string }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced !== false) {
      progress.setValue(fill);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: fill,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      // strokeDashoffset is not supported by the native driver.
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [fill, reduced, progress]);

  const dashoffset = progress.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] });

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={INSIGHT_COLORS.track}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={INSIGHT_COLORS.emphasis}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={dashoffset}
          // Start at 12 o'clock, clockwise.
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {label ? <Text style={styles.value}>{label}</Text> : null}
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  value: {
    ...typography.displayLg,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -0.5,
    color: INSIGHT_COLORS.emphasis,
  },
  caption: {
    ...text.meta,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
