import { BlurView } from 'expo-blur';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// DESIGN.md "Glass Surfaces": low-opacity white fills, backdrop-blur(40px+),
// a subtle 1px inner stroke. RN has no backdrop-filter, so BlurView (native
// blur) + a semi-transparent tint approximate the same effect.
interface GlassCardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

export function GlassCard({ style, radius = 24, children }: GlassCardProps) {
  return (
    <View style={[styles.wrapper, { borderRadius: radius }, style]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tint: {
    backgroundColor: 'rgba(30,41,59,0.4)',
  },
  content: {
    width: '100%',
  },
});
