import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { EASE_IN_OUT_SINE, useReducedMotion } from './motion';

// The glowing orb from the reference: hero-orb.png on a soft halo and glow.
// Sizes from the reference (orb 106 px, halo 160 px, x0.774).
const ORB = 84;
const HALO = 128;
const BOX = 200;

// hero-orb.png is 428x428 with its artwork in [70, 78, 338, 346] (measured
// from the alpha channel), so the artwork is 268 px and sits slightly left of
// centre. Scale and shift the image so the artwork itself fills ORB.
const SRC = 428;
const ART = 268;
const ART_CX = 204;
const ART_CY = 212;
const IMG = (ORB * SRC) / ART;
const IMG_LEFT = ORB / 2 - (ART_CX / SRC) * IMG;
const IMG_TOP = ORB / 2 - (ART_CY / SRC) * IMG;

// One slow breath: 4 s in, 4 s out. The light drifts once every 16 s.
const BREATH_MS = 4000;
const LIGHT_MS = 16000;
const BREATH_SCALE = 1.08;
const LIGHT_SIZE = ORB * 0.7;
const LIGHT_TRAVEL = 8;

// `backing` adds a faint dark disc under the glow, for bright skies where the
// glow alone would wash out.
export function PreviewOrb({ backing = false }: { backing?: boolean }) {
  const reduced = useReducedMotion();
  const breath = useRef(new Animated.Value(0)).current;
  const light = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Still unknown (null) or reduced: hold a still frame.
    if (reduced !== false) {
      breath.setValue(0);
      light.setValue(0);
      return;
    }
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_MS,
          easing: EASE_IN_OUT_SINE,
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH_MS,
          easing: EASE_IN_OUT_SINE,
          useNativeDriver: true,
        }),
      ])
    );
    const drifting = Animated.loop(
      Animated.timing(light, {
        toValue: 1,
        duration: LIGHT_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    breathing.start();
    drifting.start();
    return () => {
      breathing.stop();
      drifting.stop();
    };
  }, [reduced, breath, light]);

  const orbScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, BREATH_SCALE] });
  const glowScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const glowOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  // A small loop around the orb's upper left, like light moving on glass.
  const lightX = light.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [-LIGHT_TRAVEL, 0, LIGHT_TRAVEL, 0, -LIGHT_TRAVEL],
  });
  const lightY = light.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -LIGHT_TRAVEL, 0, LIGHT_TRAVEL, 0],
  });

  return (
    <View
      style={styles.box}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {backing && (
        <View style={styles.layer}>
          <Svg width={BOX} height={BOX}>
            <Defs>
              <RadialGradient id="orbBacking" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#0b1433" stopOpacity={0.45} />
                <Stop offset="0.55" stopColor="#0b1433" stopOpacity={0.2} />
                <Stop offset="1" stopColor="#0b1433" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={BOX / 2} cy={BOX / 2} r={BOX / 2} fill="url(#orbBacking)" />
          </Svg>
        </View>
      )}

      {/* Breathing glow: brightest at the orb's edge, fading out to the box. */}
      <Animated.View
        style={[styles.layer, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
      >
        <Svg width={BOX} height={BOX}>
          <Defs>
            <RadialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0.35" stopColor="#8cc8ff" stopOpacity={0.7} />
              <Stop offset="0.6" stopColor="#7fb4ff" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#7fb4ff" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={BOX / 2} cy={BOX / 2} r={BOX / 2} fill="url(#orbGlow)" />
        </Svg>
      </Animated.View>

      {/* Soft halo where the reference has its ring: a faint band with no edge line. */}
      <View style={[styles.layer, styles.centered]}>
        <Svg width={HALO} height={HALO}>
          <Defs>
            <RadialGradient id="orbHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.55" stopColor="#ffffff" stopOpacity={0} />
              <Stop offset="0.82" stopColor="#dbe8ff" stopOpacity={0.14} />
              <Stop offset="1" stopColor="#dbe8ff" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#orbHalo)" />
        </Svg>
      </View>

      <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
        <Image
          source={require('../../../assets/illustrations/hero-orb.png')}
          style={styles.image}
          resizeMode="contain"
        />
        <View style={styles.clip}>
          <Animated.View
            style={[styles.highlight, { transform: [{ translateX: lightX }, { translateY: lightY }] }]}
          >
            <Svg width={LIGHT_SIZE} height={LIGHT_SIZE}>
              <Defs>
                <RadialGradient id="orbLight" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity={0.5} />
                  <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle
                cx={LIGHT_SIZE / 2}
                cy={LIGHT_SIZE / 2}
                r={LIGHT_SIZE / 2}
                fill="url(#orbLight)"
              />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: ORB,
    height: ORB,
  },
  image: {
    position: 'absolute',
    width: IMG,
    height: IMG,
    left: IMG_LEFT,
    top: IMG_TOP,
  },
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: ORB / 2,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    left: ORB * 0.02,
    top: ORB * 0.0,
  },
});
