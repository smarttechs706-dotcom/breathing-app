import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';

// Real illustration, replacing the earlier programmatic-SVG placeholder.
// home-code.html's own hero image is a hotlinked Google AI Studio/"Stitch"
// preview asset (lh3.googleusercontent.com/aida-public/...) — a design-tool
// session URL, not something this project owns or has a confirmed
// production license for, so it was never bundled. Now using the real,
// project-owned illustration at assets/illustrations/hero-orb.png instead.
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
      <Image
        source={require('../../assets/illustrations/hero-orb.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
