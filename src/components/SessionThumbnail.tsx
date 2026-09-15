import { View } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, radii } from '../theme/tokens';
import type { Session } from '../types/models';

// Real per-pattern illustrations, replacing the earlier flat-gradient
// placeholder that didn't visually distinguish any pattern from another.
// library-code.html's own thumbnails are hotlinked Google AI Studio/
// "Stitch" preview images (lh3.googleusercontent.com/aida-public/...) —
// design-tool session URLs, not assets this project owns or has a
// confirmed production license for, so they aren't bundled. Built locally
// instead: each pattern below encodes the actual shape its name and the
// mockup's own `data-alt` description call for (concentric rings, a wave,
// a starburst, a dot grid, a spiral, a bloom of petals), over a soft
// radial-gradient backdrop matching DESIGN.md's glass/glow language.
const PATTERN_GRADIENTS: Record<Session['pattern'], [string, string]> = {
  rings: [colors.primary, colors.tertiary],
  wave: [colors.secondary, colors.primary],
  starburst: [colors.tertiary, colors.secondary],
  'dot-grid': [colors.primaryContainer, colors.tertiary],
  spiral: [colors.secondary, colors.tertiaryContainer],
  bloom: [colors.primary, colors.secondaryContainer],
};

const STROKE = 'rgba(255,255,255,0.85)';

function PatternMark({ pattern }: { pattern: Session['pattern'] }) {
  switch (pattern) {
    case 'rings':
      return (
        <>
          <Circle cx={50} cy={50} r={14} stroke={STROKE} strokeWidth={3} fill="none" />
          <Circle cx={50} cy={50} r={26} stroke={STROKE} strokeWidth={2.5} fill="none" opacity={0.7} />
          <Circle cx={50} cy={50} r={38} stroke={STROKE} strokeWidth={2} fill="none" opacity={0.45} />
        </>
      );
    case 'wave':
      return (
        <Path
          d="M5,55 Q20,35 35,55 T65,55 T95,55"
          stroke={STROKE}
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'starburst': {
      const rays = 8;
      return (
        <>
          {Array.from({ length: rays }).map((_, i) => {
            const angle = (i / rays) * Math.PI * 2;
            const inner = 12;
            const outer = i % 2 === 0 ? 40 : 26;
            const x1 = 50 + Math.cos(angle) * inner;
            const y1 = 50 + Math.sin(angle) * inner;
            const x2 = 50 + Math.cos(angle) * outer;
            const y2 = 50 + Math.sin(angle) * outer;
            return (
              <Line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={STROKE}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        </>
      );
    }
    case 'dot-grid': {
      const rows = 3;
      const cols = 3;
      return (
        <>
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <Circle
                key={`${r}-${c}`}
                cx={28 + c * 22}
                cy={28 + r * 22}
                r={4.5}
                fill={STROKE}
                opacity={0.4 + (r + c) * 0.08}
              />
            ))
          )}
        </>
      );
    }
    case 'spiral': {
      const turns = 2.5;
      const steps = 60;
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps;
        const angle = t * turns * Math.PI * 2;
        const radius = 4 + t * 34;
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return <Path d={points} stroke={STROKE} strokeWidth={3} strokeLinecap="round" fill="none" />;
    }
    case 'bloom': {
      const count = 6;
      return (
        <>
          {Array.from({ length: count }).map((_, i) => {
            const angle = (i / count) * Math.PI * 2;
            const cx = 50 + Math.cos(angle) * 16;
            const cy = 50 + Math.sin(angle) * 16;
            return <Circle key={i} cx={cx} cy={cy} r={16} fill={STROKE} opacity={0.28} />;
          })}
          <Circle cx={50} cy={50} r={12} fill={STROKE} opacity={0.55} />
        </>
      );
    }
  }
}

export function SessionThumbnail({
  pattern,
  size = 80,
}: {
  pattern: Session['pattern'];
  size?: number;
}) {
  const [c1, c2] = PATTERN_GRADIENTS[pattern];
  const gradientId = `sessionThumbBg-${pattern}`;
  const glowId = `sessionThumbGlow-${pattern}`;

  return (
    <View style={{ width: size, height: size, borderRadius: radii.xl, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="30%" cy="25%" r="85%">
            <Stop offset="0%" stopColor={c1} stopOpacity={1} />
            <Stop offset="100%" stopColor={c2} stopOpacity={1} />
          </RadialGradient>
          <Filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation={1.2} />
          </Filter>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#${gradientId})`} />
        <G opacity={0.85} filter={`url(#${glowId})`}>
          <PatternMark pattern={pattern} />
        </G>
      </Svg>
    </View>
  );
}
