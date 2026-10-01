import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

interface GradientTextProps extends PropsWithChildren {
  colors: [string, string, ...string[]];
  style?: StyleProp<TextStyle>;
  // Optional, forwarded to both inner Texts so a long string truncates with
  // an ellipsis instead of wrapping. Omitted (undefined) = unchanged RN
  // default behavior, so every pre-existing caller is unaffected.
  numberOfLines?: number;
}

// Standard RN gradient-text trick: an invisible Text sets the mask's shape,
// an identical invisible Text inside the LinearGradient sets its size.
export function GradientText({ colors, style, numberOfLines, children }: GradientTextProps) {
  return (
    <MaskedView
      maskElement={
        <Text style={style} numberOfLines={numberOfLines}>
          {children}
        </Text>
      }
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, { opacity: 0 }]} numberOfLines={numberOfLines}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
