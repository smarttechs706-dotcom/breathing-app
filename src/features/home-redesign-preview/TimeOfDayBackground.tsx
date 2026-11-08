import { LinearGradient as LinearGradientView } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { imageFrame, SCENES, sceneHorizon, type Scene } from './backgrounds';
import { EASE_IN_OUT_SINE, useReducedMotion } from './motion';
import type { DayPhase } from './timeOfDay';

const CROSSFADE_MS = 1500;

// Full-screen scene behind the preview. When the phase changes, the new scene
// fades in over the old one (1.5 s). With reduced motion it switches at once.
export function TimeOfDayBackground({ phase }: { phase: DayPhase }) {
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const shown = useRef(phase);
  const [layers, setLayers] = useState<{ current: DayPhase; previous: DayPhase | null }>({
    current: phase,
    previous: null,
  });

  useEffect(() => {
    if (phase === shown.current) return;
    const from = shown.current;
    shown.current = phase;

    // Unknown (null) counts as reduced: switch without moving anything.
    if (reduced !== false) {
      fade.setValue(1);
      setLayers({ current: phase, previous: null });
      return;
    }

    fade.setValue(0);
    setLayers({ current: phase, previous: from });
    const anim = Animated.timing(fade, {
      toValue: 1,
      duration: CROSSFADE_MS,
      easing: EASE_IN_OUT_SINE,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setLayers((l) => ({ current: l.current, previous: null }));
    });
    return () => anim.stop();
  }, [phase, reduced, fade]);

  return (
    <View style={styles.fill} pointerEvents="none">
      {layers.previous && <SceneLayer phase={layers.previous} />}
      <Animated.View style={[styles.fill, { opacity: fade }]}>
        <SceneLayer phase={layers.current} />
      </Animated.View>
    </View>
  );
}

function SceneLayer({ phase }: { phase: DayPhase }) {
  const { width: w, height: h } = useWindowDimensions();
  const scene = SCENES[phase];
  return scene.image ? <PaintedScene scene={scene} w={w} h={h} /> : <DrawnScene scene={scene} w={w} h={h} />;
}

function PaintedScene({ scene, w, h }: { scene: Scene; w: number; h: number }) {
  const frame = imageFrame(scene, w, h);
  return (
    <View style={[styles.fill, { backgroundColor: scene.imageBottom }]}>
      <Image
        source={scene.image!}
        style={{
          position: 'absolute',
          top: frame.top,
          left: frame.left,
          width: frame.width,
          height: frame.height,
        }}
      />
      {/* Shade the top for the greeting, and the lower part for the cards. */}
      <LinearGradientView
        colors={['rgba(6,10,28,0.55)', 'rgba(6,10,28,0)']}
        style={[styles.topShade, { height: h * 0.28 }]}
      />
      <LinearGradientView
        colors={['rgba(6,10,28,0)', 'rgba(6,10,28,0.6)', 'rgba(6,10,28,0.88)']}
        // Stronger: reaches 0.6 within the first 15% (just under the
        // horizon, behind the card) instead of at 45%.
        locations={scene.strongBottomShade ? [0, 0.15, 1] : [0, 0.45, 1]}
        style={[styles.bottomShade, { height: h * 0.55 }]}
      />
    </View>
  );
}

// Drawn fallback: sky gradient, sun on the horizon (or a small moon high in
// the upper right), two hill layers left and right, water.
function DrawnScene({ scene, w, h }: { scene: Scene; w: number; h: number }) {
  const hy = Math.round(h * sceneHorizon(scene));
  const isSun = scene.light.kind === 'sun';
  const lx = isSun ? w * 0.77 : w * 0.86;
  const ly = isSun ? hy : hy * 0.22;
  const discR = isSun ? 14 : 6;
  const glowR = isSun ? 96 : 30;

  return (
    <Svg width={w} height={h} style={styles.fill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={scene.sky[0]} />
          <Stop offset="0.45" stopColor={scene.sky[1]} />
          <Stop offset="0.8" stopColor={scene.sky[2]} />
          <Stop offset="1" stopColor={scene.sky[3]} />
        </LinearGradient>
        <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={scene.water[0]} />
          <Stop offset="0.35" stopColor={scene.water[1]} />
          <Stop offset="1" stopColor={scene.water[2]} />
        </LinearGradient>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={scene.light.color} stopOpacity={scene.light.glow} />
          <Stop offset="1" stopColor={scene.light.color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="reflection" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={scene.light.color} stopOpacity={scene.light.glow * 0.5} />
          <Stop offset="1" stopColor={scene.light.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Rect x={0} y={0} width={w} height={hy} fill="url(#sky)" />
      <Circle cx={lx} cy={ly} r={discR} fill={scene.light.color} opacity={isSun ? 1 : 0.8} />
      <Rect x={0} y={hy} width={w} height={h - hy} fill="url(#water)" />
      <Circle cx={lx} cy={ly} r={glowR} fill="url(#glow)" />
      {isSun && <Ellipse cx={lx} cy={hy + 8} rx={32} ry={3} fill="url(#reflection)" />}

      {/* Left hills, far then near */}
      <Path
        d={`M0 ${hy} L0 ${hy - 30} Q${w * 0.12} ${hy - 54} ${w * 0.24} ${hy - 32} Q${w * 0.34} ${hy - 16} ${w * 0.48} ${hy} Z`}
        fill={scene.farHills}
      />
      <Path
        d={`M0 ${hy} L0 ${hy - 12} Q${w * 0.16} ${hy - 26} ${w * 0.3} ${hy - 6} L${w * 0.36} ${hy} Z`}
        fill={scene.nearHills}
      />
      {/* Right hills, behind the sun's right side */}
      <Path
        d={`M${w * 0.8} ${hy} Q${w * 0.9} ${hy - 34} ${w} ${hy - 40} L${w} ${hy} Z`}
        fill={scene.farHills}
      />
      <Path
        d={`M${w * 0.87} ${hy} Q${w * 0.94} ${hy - 16} ${w} ${hy - 18} L${w} ${hy} Z`}
        fill={scene.nearHills}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
  },
  topShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
