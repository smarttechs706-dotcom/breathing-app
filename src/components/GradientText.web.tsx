import type { PropsWithChildren } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

interface GradientTextProps extends PropsWithChildren {
  colors: [string, string, ...string[]];
  style?: StyleProp<TextStyle>;
}

// Web-only override (Metro resolves *.web.tsx over the platform-agnostic
// file when bundling for web). @react-native-masked-view/masked-view's own
// web shim (node_modules/@react-native-masked-view/masked-view/js/MaskedView.web.js)
// is a no-op that renders only the flat maskElement and discards the
// gradient entirely — it has no masking implementation on web at all, so
// GradientText.tsx's native approach can never show a gradient in a browser.
// CSS background-clip: text is the real web equivalent; every evergreen
// browser supports it, and RN Web forwards unrecognized camelCase style
// keys straight through to CSS.
export function GradientText({ colors, style, children }: GradientTextProps) {
  const backgroundImage = `linear-gradient(90deg, ${colors.join(', ')})`;
  // web-only CSS properties (background-clip/-webkit-background-clip),
  // not part of RN's TextStyle typings.
  const webGradientStyle = {
    backgroundImage,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
  } as unknown as TextStyle;

  return <Text style={[style, webGradientStyle]}>{children}</Text>;
}
