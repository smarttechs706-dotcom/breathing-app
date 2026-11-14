import { LinearGradient as ShadeGradient } from 'expo-linear-gradient';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';

import { LoopingVideo } from '../media/LoopingVideo';
import {
  ALPHA_OFFSETS,
  BOTTOM_FADE,
  edgeAlpha,
  heroVideoFrame,
  shadeHeight,
  topShadeStops,
} from './heroLayout';

// The top shade's colour (the app's navy); its strength is TOP_SHADE.
const SHADE_RGB = '10,16,40';
// The bottom fade runs this far past the hero's bottom edge (the hero clips
// it), so its solid end always covers the last pixel row. Without it, the
// SVG's height rounded to one pixel row short and the video's own bottom row
// showed as a thin light line (row 1003 on this phone, delta E about 8).
const FADE_OVERHANG = 2;

// Home's full-bleed hero: the looping horizon video from the top of the
// screen (behind the status bar, greeting and week row) down to `height`,
// scrolling with the content. Muted, no controls. The crop keeps the sunset
// in view (heroLayout.ts). Only the bottom dissolves into the mist backdrop:
// a strip filled with the backdrop's own colours across the width, under an
// eased alpha mask. There is no top fade; a very light navy shade (TOP_SHADE)
// eases from the top to clear just below the horizon. While the video loads,
// with reduced motion, or if it fails, the hero is empty and the mist shows.

const SOURCE = require('../../../assets/videos/home-horizon-band-loop.mp4');

type ColorStop = { offset: number; color: string };

// The mist backdrop just below the hero's bottom edge, sampled at 8 positions
// across the width on the phone (1080 x 2408 screenshot, 41 x 8 px boxes,
// 3-10 px below the edge).
export const HERO_BOTTOM_COLORS: ColorStop[] = [
  { offset: 0, color: '#05153e' },
  { offset: 0.1429, color: '#061b4a' },
  { offset: 0.2857, color: '#0a2456' },
  { offset: 0.4286, color: '#0a265b' },
  { offset: 0.5714, color: '#0c2a61' },
  { offset: 0.7143, color: '#0c2b62' },
  { offset: 0.8571, color: '#082459' },
  { offset: 1, color: '#08245a' },
];

function BottomFade({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={styles.fade} pointerEvents="none">
      <Defs>
        <LinearGradient id="hero-colors" x1="0" y1="0" x2="1" y2="0">
          {HERO_BOTTOM_COLORS.map((c) => (
            <Stop key={c.offset} offset={c.offset} stopColor={c.color} stopOpacity={1} />
          ))}
        </LinearGradient>
        <LinearGradient id="hero-alpha" x1="0" y1="0" x2="0" y2="1">
          {ALPHA_OFFSETS.map((o) => (
            <Stop key={o} offset={o} stopColor="#ffffff" stopOpacity={edgeAlpha(1 - o)} />
          ))}
        </LinearGradient>
        <Mask id="hero-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill="url(#hero-alpha)" />
        </Mask>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#hero-colors)" mask="url(#hero-mask)" />
    </Svg>
  );
}

export function HomeHero({ height }: { height: number }) {
  const { width: windowW } = useWindowDimensions();
  const frame = heroVideoFrame(windowW, height);
  // A little wider than the window and shifted 1 dp left, so rounding never
  // leaves an uncovered pixel column of raw video at either side.
  const fadeW = Math.ceil(windowW) + 2;
  const shade = topShadeStops();
  return (
    <View
      style={[styles.hero, { height }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.video,
          { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
        ]}
      >
        <LoopingVideo source={SOURCE} surfaceType="textureView" />
      </View>
      <ShadeGradient
        colors={shade.map((s) => `rgba(${SHADE_RGB},${s.alpha.toFixed(4)})`) as [string, string, ...string[]]}
        locations={shade.map((s) => s.offset) as [number, number, ...number[]]}
        style={[styles.shade, { height: shadeHeight(frame) }]}
      />
      <BottomFade width={fadeW} height={Math.round(height * BOTTOM_FADE) + FADE_OVERHANG} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  video: {
    position: 'absolute',
  },
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  fade: {
    position: 'absolute',
    bottom: -FADE_OVERHANG,
    left: -1,
  },
});
