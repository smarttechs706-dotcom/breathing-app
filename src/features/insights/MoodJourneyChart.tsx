import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { text } from '../home/styles';
import { colors } from '../../theme/tokens';
import { INSIGHT_COLORS } from './insightColors';
import type { JourneyDay } from './insightsModel';

// Before (slate) and After (white) mood per day of this week, on a 1-5 scale.
// Only days with a real check-in get a point; consecutive days are joined,
// and a day without data breaks the line. Nothing is interpolated.

const HEIGHT = 132;
const PAD_Y = 14;

function yFor(mood: number): number {
  const t = (mood - 1) / 4; // 1..5 -> 0..1
  return PAD_Y + (1 - t) * (HEIGHT - PAD_Y * 2);
}

function linePath(points: ({ x: number; y: number } | null)[]): string {
  let d = '';
  let open = false;
  for (const p of points) {
    if (!p) {
      open = false;
      continue;
    }
    d += `${open ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    open = true;
  }
  return d.trim();
}

export function MoodJourneyChart({ days }: { days: JourneyDay[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const col = width / Math.max(days.length, 1);
  const xFor = (i: number) => col * (i + 0.5);

  const before = days.map((d, i) => (d.before === null ? null : { x: xFor(i), y: yFor(d.before) }));
  const after = days.map((d, i) => (d.after === null ? null : { x: xFor(i), y: yFor(d.after) }));
  const empty = days.every((d) => d.count === 0);

  return (
    <View>
      <View style={styles.plot} onLayout={onLayout}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {days.map((_, i) => (
              <Line
                key={i}
                x1={xFor(i)}
                x2={xFor(i)}
                y1={PAD_Y}
                y2={HEIGHT - PAD_Y}
                stroke={INSIGHT_COLORS.grid}
                strokeWidth={1}
              />
            ))}
            <Path d={linePath(before)} stroke={INSIGHT_COLORS.before} strokeWidth={2.5} fill="none" />
            <Path d={linePath(after)} stroke={INSIGHT_COLORS.emphasis} strokeWidth={2.5} fill="none" />
            {/* Before is a slightly larger slate ring drawn first, so it stays
                visible around the white After dot when the two are equal. */}
            {before.map((p, i) =>
              p ? (
                <Circle
                  key={`b${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={7}
                  fill="none"
                  stroke={INSIGHT_COLORS.before}
                  strokeWidth={2.5}
                />
              ) : null
            )}
            {after.map((p, i) =>
              p ? <Circle key={`a${i}`} cx={p.x} cy={p.y} r={4.5} fill={INSIGHT_COLORS.emphasis} /> : null
            )}
          </Svg>
        )}
        {empty && (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Text style={styles.emptyText}>No check-ins this week yet.</Text>
          </View>
        )}
      </View>
      <View style={styles.labels}>
        {days.map((d) => (
          <Text key={d.key} style={[styles.dayLabel, d.isToday && styles.today]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    height: HEIGHT,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...text.body,
    color: colors.onSurfaceVariant,
  },
  labels: {
    flexDirection: 'row',
    marginTop: 8,
  },
  dayLabel: {
    ...text.meta,
    flex: 1,
    textAlign: 'center',
    color: colors.onSurfaceVariant,
  },
  today: {
    color: INSIGHT_COLORS.emphasis,
  },
});
