import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { LoopingVideo } from '../media/LoopingVideo';

// Home's horizon band: the looping 1280 x 512 (2.5 : 1) video, full width
// between the week row and the Featured card, muted and without controls.
// Its top and bottom edges fade into the mist backdrop behind it. While the
// video loads, with reduced motion, or if it fails, the band is empty and
// the backdrop shows.

const SOURCE = require('../../../assets/videos/home-horizon-band-loop.mp4');

// The mist backdrop's colour at the band's top and bottom edges, sampled on
// the phone (row averages, 1080 x 2408 screenshot). The edges fade to these.
export const BAND_EDGE_TOP = '#051339';
export const BAND_EDGE_BOTTOM = '#071d4c';
// Share of the band's height that each edge fade covers (about 20 dp on a
// 411 dp phone). Each fade is solid at the edge, 40% at its midpoint and
// clear at its inner end; there is no tint over the rest of the video.
export const BAND_EDGE_FADE = 0.12;
const MID_ALPHA = '66'; // 40%

export function HorizonBand({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  const fadeH = Math.round(height * BAND_EDGE_FADE);
  return (
    <View
      style={[{ height }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LoopingVideo source={SOURCE} surfaceType="textureView" />
      <LinearGradient
        colors={[BAND_EDGE_TOP, `${BAND_EDGE_TOP}${MID_ALPHA}`, `${BAND_EDGE_TOP}00`]}
        locations={[0, 0.5, 1]}
        style={[styles.edge, styles.top, { height: fadeH }]}
      />
      <LinearGradient
        colors={[`${BAND_EDGE_BOTTOM}00`, `${BAND_EDGE_BOTTOM}${MID_ALPHA}`, BAND_EDGE_BOTTOM]}
        locations={[0, 0.5, 1]}
        style={[styles.edge, styles.bottom, { height: fadeH }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
});
