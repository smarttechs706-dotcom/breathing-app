import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

// Motion rules for the preview (emil-design-eng): ease-out for things that
// enter or respond to touch, ease-in-out for the orb's continuous breathing.
// Short for UI (160-300 ms), slow only for the ambient orb.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT_SINE = Easing.bezier(0.37, 0, 0.63, 1);

const PRESS_MS = 160;
const ENTER_MS = 300;
const ENTER_RISE = 8;
export const STAGGER_MS = 50;

// True when the system "Remove animations" / "Reduce motion" setting is on.
// null until the setting has been read, so nothing starts moving early.
export function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

// For ambient background motion (the looping background videos).
// `allowed`: reduced motion is known to be off (unknown counts as reduced).
// `running`: allowed, and the screen has focus, and the app is in the
// foreground. Loops run only while `running`; otherwise they hold still.
export function useAmbientMotion(): { allowed: boolean; running: boolean } {
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  const allowed = reduced === false;
  return { allowed, running: allowed && focused && foreground };
}

// Fades in and rises 8pt once on mount. With reduced motion it only fades.
export function FadeIn({
  delay = 0,
  style,
  children,
}: PropsWithChildren<{ delay?: number; style?: StyleProp<ViewStyle> }>) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: ENTER_MS,
      delay,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);

  // Unknown counts as reduced: a fade is safe either way, movement is not.
  const translateY = reduced !== false
    ? 0
    : progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_RISE, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// Pressable that dips to 0.97 while held. With reduced motion it dims instead.
// `outerStyle` sizes the touch target; `style` goes on the part that scales.
export function PressableScale({
  style,
  outerStyle,
  children,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  outerStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const pressed = useRef(new Animated.Value(0)).current;

  const to = (value: number) =>
    Animated.timing(pressed, {
      toValue: value,
      duration: PRESS_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();

  const animatedStyle = reduced
    ? { opacity: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }
    : { transform: [{ scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }] };

  return (
    <Pressable {...props} style={outerStyle} onPressIn={() => to(1)} onPressOut={() => to(0)}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
