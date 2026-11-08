// Pure layout and timing for the ambient background motion: painting drift,
// night twinkle and water shimmer. No React Native imports, so it is tested
// directly in Node (tests/home-redesign-preview).

// --- Painting placement ---------------------------------------------------

export interface Frame {
  width: number;
  height: number;
  left: number;
  top: number;
}

// Cover the screen, centre horizontally, then shift up (cropping sky only) so
// the painting's horizon lands at `horizonOnScreen` (share of screen height).
// Never shifted down; the strip left at the bottom is filled by the caller.
export function paintingFrame(
  imageW: number,
  imageH: number,
  screenW: number,
  screenH: number,
  horizon: number,
  horizonOnScreen: number
): Frame {
  const scale = Math.max(screenW / imageW, screenH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  const top = Math.min(0, screenH * horizonOnScreen - height * horizon);
  return { width, height, left: (screenW - width) / 2, top };
}

// --- A. Slow drift --------------------------------------------------------

// The painting is always shown at least 1.06x (also when still), so drifting
// never reveals an edge. One full back-and-forth takes 2 x DRIFT_HALF_MS.
export const DRIFT_MIN_SCALE = 1.06;
export const DRIFT_MAX_SCALE = 1.08;
export const DRIFT_SHIFT_X = 4; // dp each way
export const DRIFT_HALF_MS = 25_000;

// React Native scales a view about its own centre. This vertical shift puts
// the horizon row back exactly where it was for a given scale.
export function driftTranslateY(frame: Frame, horizonY: number, scale: number): number {
  const horizonInFrame = horizonY - frame.top;
  return (1 - scale) * (horizonInFrame - frame.height / 2);
}

// Where the painting's edges land on screen for a given scale and sideways shift.
export function driftEdges(frame: Frame, horizonY: number, scale: number, shiftX: number) {
  const cx = frame.width / 2;
  const cy = frame.height / 2;
  const ty = driftTranslateY(frame, horizonY, scale);
  return {
    left: frame.left + cx * (1 - scale) + shiftX,
    right: frame.left + cx * (1 + scale) + shiftX,
    top: frame.top + cy * (1 - scale) + ty,
    bottom: frame.top + cy * (1 + scale) + ty,
    // Where the horizon row itself ends up (should equal horizonY).
    horizon: frame.top + cy + scale * (horizonY - frame.top - cy) + ty,
  };
}

// --- B. Night twinkle -----------------------------------------------------

export const TWINKLE_COUNT = 14;
export const TWINKLE_LOOP_MS = 9_000;
export const TWINKLE_LOW = 0.15;
// Kept below the painting's own brightest stars, so the dots don't stand out.
export const TWINKLE_HIGH = 0.6;
export const STAR_MIN_SIZE = 1.5; // dp
export const STAR_MAX_SIZE = 2; // dp
// Chosen so neither side band lines up (x-y correlation 0.05 in the worse
// band) and no two stars are closer than 16 dp on the test phone.
export const STAR_SEED = 110;

// Two side bands of sky (shares of screen width / height): below the week row,
// above the hills, left and right of the orb's glow, clear of moon and text.
export const STAR_BANDS = {
  left: [0.05, 0.22],
  right: [0.78, 0.95],
  y: [0.2, 0.34],
} as const;

export interface Star {
  x: number; // share of screen width
  y: number; // share of screen height
  size: number; // dp, STAR_MIN_SIZE or STAR_MAX_SIZE
  phase: number; // 0-1, where in the shared loop this star peaks
}

// Small seeded generator, so the stars sit in the same places every time.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function twinkleStars(count: number = TWINKLE_COUNT, seed: number = STAR_SEED): Star[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const band = i % 2 === 0 ? STAR_BANDS.left : STAR_BANDS.right;
    return {
      x: band[0] + rand() * (band[1] - band[0]),
      y: STAR_BANDS.y[0] + rand() * (STAR_BANDS.y[1] - STAR_BANDS.y[0]),
      size: rand() < 0.5 ? STAR_MIN_SIZE : STAR_MAX_SIZE,
      phase: rand(),
    };
  });
}

// Opacity over one shared loop (0-1) for a star: a soft triangle wave between
// low and high, shifted by the star's phase. Value at 0 equals value at 1, so
// the loop restarts without a jump.
export function twinkleCurve(
  phase: number,
  low: number = TWINKLE_LOW,
  high: number = TWINKLE_HIGH,
  steps = 8
): { inputRange: number[]; outputRange: number[] } {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const x = k / steps;
    const u = (((x - phase) % 1) + 1) % 1;
    const tri = 1 - Math.abs(2 * u - 1);
    inputRange.push(x);
    outputRange.push(low + (high - low) * tri);
  }
  return { inputRange, outputRange };
}

// --- C. Water shimmer -----------------------------------------------------

// A soft band just below the horizon, above the Featured card (which stays at
// least 40 dp below the horizon), drifting across once per loop.
export const SHIMMER_LOOP_MS = 18_000;
export const SHIMMER_OFFSET = 18; // dp below the horizon (band top)
export const SHIMMER_HEIGHT = 14; // dp
export const SHIMMER_WIDTH_SHARE = 0.5; // of screen width
export const SHIMMER_PEAK_OPACITY = 0.1;
