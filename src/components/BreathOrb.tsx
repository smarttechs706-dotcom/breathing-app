import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../theme/tokens';

// Real illustration, replacing the earlier flat-LinearGradient placeholder.
// home-code.html's own hero image is a hotlinked Google AI Studio/"Stitch"
// preview asset (lh3.googleusercontent.com/aida-public/...) — a design-tool
// session URL, not something this project owns or has a confirmed
// production license for, so it isn't bundled. Built locally instead,
// directly off DESIGN.md's own spec for this element ("a large, central
// sphere that pulses with a soft glow", "soft, diffused radial gradients",
// "circular or soft-edged geometry") rather than trying to replicate the
// mockup's photo-illustration pixel-for-pixel.
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
      style={[styles.container, { width: size, height: size, transform: [{ scale }] }]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="orbGlow" cx="50%" cy="48%" r="55%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.55} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="orbCore" cx="35%" cy="30%" r="75%">
            <Stop offset="0%" stopColor={colors.tertiary} stopOpacity={1} />
            <Stop offset="55%" stopColor={colors.primary} stopOpacity={1} />
            <Stop offset="100%" stopColor={colors.primaryContainer} stopOpacity={1} />
          </RadialGradient>
          <Filter id="orbBlur" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation={5} />
          </Filter>
        </Defs>
        {/* Soft ambient glow behind the sphere */}
        <Circle cx={50} cy={50} r={30} fill="url(#orbGlow)" filter="url(#orbBlur)" />
        {/* The sphere itself */}
        <Circle cx={50} cy={50} r={34} fill="url(#orbCore)" />
        {/* Glossy highlight for a soft 3D feel */}
        <Circle cx={38} cy={34} r={9} fill="#ffffff" opacity={0.25} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
