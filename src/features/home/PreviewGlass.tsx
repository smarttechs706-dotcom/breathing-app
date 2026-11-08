import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accents } from './styles';

// Preview-only light glass: a pale see-through fill and a hairline edge, like
// the reference's cards. No blur (Android's expo-blur only tints), so it reads
// the same on both platforms. The shared GlassCard is not changed.
export function PreviewGlass({
  radius,
  style,
  children,
}: PropsWithChildren<{ radius: number; style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.glass, { borderRadius: radius }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: accents.glassBorder,
    backgroundColor: accents.glassFill,
  },
});
