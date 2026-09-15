import Svg, {
  Defs,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import type { MoodPoint } from '../data/insights';
import { colors } from '../theme/tokens';

// insights-code.html's chart is a hand-built SVG (path + gradient fill +
// glow filter) rather than a generic chart-library look — reproducing
// that structure directly instead of pulling in a full charting library,
// so the "calming glowing wave" aesthetic matches exactly. The mockup's
// own path is a literal hardcoded demo squiggle; this builds the
// equivalent shape from real mood data instead (see src/data/insights.ts).
const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 200;
const VERTICAL_PADDING = 20;
// Confirmed against insights-screenshot.png: the curve has a small inset
// from the card's own inner content edge, not the sharp edge-to-edge
// touch a 0-to-VIEWBOX_WIDTH point range produces (that mapped the first/
// last point exactly to x=0/x=600, i.e. flush with the SVG's own bounds).
const HORIZONTAL_PADDING = 20;

interface Point {
  x: number;
  y: number;
}

// Smooth line through points using quadratic Beziers to the midpoint of
// each consecutive pair, finishing with a smooth-quadratic (T) segment to
// the last point — the same technique insights-code.html's own path uses
// (its `Q ... T ... T ...` commands), just computed from real data instead
// of hand-authored.
function buildSmoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x},${points[i].y} ${midX},${midY}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x},${last.y}`;
  return d;
}

function moodToPoints(data: MoodPoint[]): Point[] {
  const innerWidth = VIEWBOX_WIDTH - HORIZONTAL_PADDING * 2;
  return data.map((point, index) => {
    const x =
      data.length > 1
        ? HORIZONTAL_PADDING + (index / (data.length - 1)) * innerWidth
        : VIEWBOX_WIDTH / 2;
    // mood 1 (stressed) -> near the bottom; mood 5 (calm) -> near the top.
    const normalized = (point.mood - 1) / 4;
    const y =
      VERTICAL_PADDING + (1 - normalized) * (VIEWBOX_HEIGHT - VERTICAL_PADDING * 2);
    return { x, y };
  });
}

export function MoodTrendChart({
  data,
  height = 200,
}: {
  data: MoodPoint[];
  height?: number;
}) {
  const points = moodToPoints(data);
  if (points.length === 0) return null;

  const linePath = buildSmoothPath(points);
  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;
  const fillPath = `${linePath} L ${lastX},${VIEWBOX_HEIGHT} L ${firstX},${VIEWBOX_HEIGHT} Z`;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="moodWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.primaryContainer} stopOpacity={0.5} />
          <Stop offset="100%" stopColor={colors.background} stopOpacity={0} />
        </LinearGradient>
        <Filter id="moodWaveGlow" x="-20%" y="-20%" width="140%" height="140%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={4} result="blurred" />
          <FeMerge>
            <FeMergeNode in="blurred" />
            <FeMergeNode in="SourceGraphic" />
          </FeMerge>
        </Filter>
      </Defs>
      <Path d={fillPath} fill="url(#moodWaveGradient)" stroke="none" />
      <Path
        d={linePath}
        fill="none"
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#moodWaveGlow)"
      />
    </Svg>
  );
}
