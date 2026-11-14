import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../home/motion';
import { TOP_BAR_HEIGHT, contentSpacer, type PlayerPhase } from './sessionModel';

// The session player's background: the navy gradient used by Profile and
// Library, the same on every phase and for every session. The per-session
// paintings are gone; one looping background video goes here in a later step
// (with a navy dim per phase). Until then `sessionId` and `phase` are unused,
// kept so app/session-player.tsx does not change.

const NAVY_TOP = '#0a1028';
const NAVY_BOTTOM = '#00051a';

export function SessionBackdrop(_props: { sessionId: string | null; phase: PlayerPhase }) {
  const insets = useSafeAreaInsets();
  const scrimH = insets.top + TOP_BAR_HEIGHT + 40;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[NAVY_TOP, NAVY_BOTTOM]} style={StyleSheet.absoluteFill} />
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
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
