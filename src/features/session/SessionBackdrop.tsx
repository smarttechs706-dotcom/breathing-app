import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EASE_OUT, useReducedMotion } from '../home/motion';
import {
  PAINTING_FADE_START,
  TOP_BAR_HEIGHT,
  backdropOpacities,
  contentSpacer,
  paintingHeight,
  type PlayerPhase,
} from './sessionModel';
import { SESSION_IMAGES, SESSION_PORTRAITS } from './sessionImages';

// The session player's background: the navy gradient used by Profile and
// Library, with the session's painting across the top fading into it. On the
// breathing screen a session with a portrait painting crossfades to it, full
// screen and dimmed so the orb stays the focus; without one, the top painting
// just dims. Session Complete brings the top painting most of the way back.
// Nothing ever moves; only brightness changes, over 400 ms, or at once with
// reduced motion. A session without a painting (or none yet) shows the plain
// navy gradient.

const NAVY_TOP = '#0a1028';
const NAVY_BOTTOM = '#00051a';
const DIM_MS = 400;

// Animates `value` to `target` over DIM_MS, or sets it at once with reduced
// motion (unknown counts as reduced).
function useOpacityTo(target: number, reduced: boolean | null) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced !== false) {
      value.setValue(target);
      return;
    }
    const anim = Animated.timing(value, {
      toValue: target,
      duration: DIM_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [target, reduced, value]);
  return value;
}

export function SessionBackdrop({ sessionId, phase }: { sessionId: string | null; phase: PlayerPhase }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const image = sessionId ? SESSION_IMAGES[sessionId] : undefined;
  const portraitImage = sessionId ? SESSION_PORTRAITS[sessionId] : undefined;
  const paintH = paintingHeight(width);
  const targets = backdropOpacities(phase, portraitImage !== undefined);

  const opacity = useOpacityTo(targets.top, reduced);
  const portraitOpacity = useOpacityTo(targets.portrait, reduced);

  // The navy stays at NAVY_TOP down to the painting's lower edge, so the
  // painting's own fade lands on exactly the same colour.
  const navyStop = Math.min(0.9, paintH / Math.max(height, 1));
  const scrimH = insets.top + TOP_BAR_HEIGHT + 40;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[NAVY_TOP, NAVY_TOP, NAVY_BOTTOM]}
        locations={[0, navyStop, 1]}
        style={StyleSheet.absoluteFill}
      />
      {portraitImage && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: portraitOpacity }]}>
          <Image source={portraitImage} style={styles.image} resizeMode="cover" fadeDuration={0} />
        </Animated.View>
      )}
      {image && (
        <Animated.View style={[styles.painting, { height: paintH, opacity }]}>
          <Image source={image} style={styles.image} resizeMode="cover" fadeDuration={0} />
          <LinearGradient
            colors={['rgba(10,16,40,0)', NAVY_TOP]}
            locations={[PAINTING_FADE_START, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      {/* Keeps the top bar (close, title, gear) readable over a bright sky:
          strong behind the status bar and top bar, gone just below them. */}
      <LinearGradient
        colors={['rgba(5,10,30,0.8)', 'rgba(5,10,30,0.7)', 'rgba(5,10,30,0)']}
        locations={[0, 0.6, 1]}
        style={[styles.scrim, { height: scrimH }]}
      />
    </View>
  );
}

// Empty space at the top of the player's scroll content, so the content
// starts over the painting's fade instead of covering the painting.
export function BackdropSpacer() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <View style={{ height: contentSpacer(width, insets.top) }} />;
}

// The player's phase transition: fade + a slight scale-up, or fade only when
// reduced motion is on (or not yet known). `progress` runs 0 -> 1 on each
// phase change; the timing itself stays in app/session-player.tsx.
export function PhaseTransition({
  progress,
  style,
  children,
}: {
  progress: Animated.Value;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: reduced !== false ? [1, 1] : [0.97, 1],
  });
  return <Animated.View style={[style, { opacity: progress, transform: [{ scale }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  painting: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: NAVY_TOP,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
