import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { LoopingVideo } from '../media/LoopingVideo';
import { SESSION_PORTRAITS } from './sessionImages';
import {
  BREATHING_SCRIM,
  TOP_BAR_HEIGHT,
  backdropLayers,
  contentSpacer,
  type PlayerPhase,
} from './sessionModel';

// The session player's background, per phase (sessionModel.backdropLayers):
// the session's portrait painting before the session (80%) and on Session
// Complete (70%); while breathing, no painting but the looping background
// video under a 55% navy scrim. The navy gradient is always underneath, and
// is all that shows on the loading and error screens (no session yet).
// Phases crossfade over 400 ms, or switch at once with reduced motion. The
// video is mounted only while breathing (plus its 400 ms fade-out), and
// LoopingVideo also unmounts it when the screen loses focus or the app goes
// to the background, so there is never more than one video decoding.

const NAVY_TOP = '#0a1028';
const NAVY_BOTTOM = '#00051a';
const DIM_MS = 400;

const BREATHING_VIDEO = require('../../../assets/videos/breathing-background-loop.mp4');

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

// True while the video should be mounted: from the moment breathing starts
// until its fade-out has finished (at once with reduced motion).
function useVideoMounted(on: boolean, reduced: boolean | null) {
  const [mounted, setMounted] = useState(on);
  useEffect(() => {
    if (on) {
      setMounted(true);
      return;
    }
    if (reduced !== false) {
      setMounted(false);
      return;
    }
    const id = setTimeout(() => setMounted(false), DIM_MS);
    return () => clearTimeout(id);
  }, [on, reduced]);
  return mounted;
}

export function SessionBackdrop({ sessionId, phase }: { sessionId: string | null; phase: PlayerPhase }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const layers = backdropLayers(phase, sessionId);
  const portraitImage = sessionId ? SESSION_PORTRAITS[sessionId] : undefined;

  const portraitOpacity = useOpacityTo(layers.portrait, reduced);
  const videoOpacity = useOpacityTo(layers.video ? 1 : 0, reduced);
  const videoMounted = useVideoMounted(layers.video, reduced);
  const scrimH = insets.top + TOP_BAR_HEIGHT + 40;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[NAVY_TOP, NAVY_BOTTOM]} style={StyleSheet.absoluteFill} />
      {portraitImage && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: portraitOpacity }]}>
          <Image source={portraitImage} style={styles.image} resizeMode="cover" fadeDuration={0} />
        </Animated.View>
      )}
      {videoMounted && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]}>
          {/* TextureView, so the crossfade opacity applies to the video. */}
          <LoopingVideo source={BREATHING_VIDEO} surfaceType="textureView" />
          <View style={[StyleSheet.absoluteFill, styles.breathingScrim]} />
        </Animated.View>
      )}
      {/* Keeps the top bar (close, title, gear) readable over a bright
          background: strong behind the status bar and top bar, gone just
          below them. */}
      <LinearGradient
        colors={['rgba(5,10,30,0.8)', 'rgba(5,10,30,0.7)', 'rgba(5,10,30,0)']}
        locations={[0, 0.6, 1]}
        style={[styles.scrim, { height: scrimH }]}
      />
    </View>
  );
}

// Empty space at the top of the player's scroll content. Its height is
// unchanged from when a painting sat there, so the content does not move.
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
  image: {
    width: '100%',
    height: '100%',
  },
  // Navy over the breathing video (sessionModel BREATHING_SCRIM, 55%).
  breathingScrim: {
    backgroundColor: `rgba(10,16,40,${BREATHING_SCRIM})`,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
