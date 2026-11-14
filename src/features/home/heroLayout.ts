// Pure layout rules for Home's full-bleed hero video (HomeHero.tsx). No React
// Native imports, so it is tested directly in Node (tests/home/home.test.cjs).

// The hero runs from the top of the screen (behind the status bar) down to
// about 42% of the screen height: about 383 dp on a 917 dp tall phone, where
// the old horizon band ended. Clamped for small and very tall screens.
export const HERO_SHARE = 0.417;
export const HERO_MIN = 300;
export const HERO_MAX = 440;

export function heroHeight(windowHeight: number): number {
  return Math.round(Math.min(Math.max(windowHeight * HERO_SHARE, HERO_MIN), HERO_MAX));
}

// The video file: 1280 x 512. The sun sits around x = 1100 (measured on the
// phone, 1020-1125), so a centred crop would cut it off; the crop is shifted
// to keep it about 70% across the screen.
export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 512;
export const SUN_X = 1100;
export const SUN_ON_SCREEN = 0.7;

export interface VideoFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number; // dp per video pixel
}

// Where the video sits inside the hero so it covers it completely (like
// 'cover'), with the sun kept in view. Never leaves an uncovered edge.
export function heroVideoFrame(screenWidth: number, heroHeightDp: number): VideoFrame {
  const scale = Math.max(screenWidth / VIDEO_WIDTH, heroHeightDp / VIDEO_HEIGHT);
  const width = VIDEO_WIDTH * scale;
  const height = VIDEO_HEIGHT * scale;
  const wanted = SUN_ON_SCREEN * screenWidth - SUN_X * scale;
  const left = Math.min(0, Math.max(screenWidth - width, wanted));
  const top = (heroHeightDp - height) / 2;
  return { left, top, width, height, scale };
}

// The sea horizon in the video file (measured on the phone: y = 258 of 512).
export const HORIZON_Y = 258;

// Where the horizon lands inside the hero, in dp from its top.
export function horizonOnHero(frame: VideoFrame): number {
  return frame.top + HORIZON_Y * frame.scale;
}

// A very light navy shade over the top of the hero, to tone the sky and the
// sun down a touch: TOP_SHADE at the top, easing (edgeAlpha) to clear
// SHADE_PAST_HORIZON below the horizon, so it still reaches the sun (which
// sits on the horizon) at about half strength.
export const TOP_SHADE = 0.1;
export const SHADE_PAST_HORIZON = 30;

export function shadeHeight(frame: VideoFrame): number {
  return horizonOnHero(frame) + SHADE_PAST_HORIZON;
}
export const TOP_SHADE_STEPS = 5;
export function topShadeStops(): { offset: number; alpha: number }[] {
  return Array.from({ length: TOP_SHADE_STEPS }, (_, i) => {
    const offset = i / (TOP_SHADE_STEPS - 1);
    return { offset, alpha: TOP_SHADE * edgeAlpha(offset) };
  });
}

// The bottom fade covers this share of the hero. There is no top fade.
export const BOTTOM_FADE = 0.4;

// Eased alpha from the outer edge (t = 0, solid) to the inner end (t = 1,
// clear): a cosine ease-in-out, so the fade has no visible start or end line.
export function edgeAlpha(t: number): number {
  return 0.5 * (1 + Math.cos(Math.PI * Math.min(Math.max(t, 0), 1)));
}

// Gradient stop positions for the alpha mask (at least 5; 7 here).
export const ALPHA_STEPS = 7;
export const ALPHA_OFFSETS: number[] = Array.from(
  { length: ALPHA_STEPS },
  (_, i) => i / (ALPHA_STEPS - 1)
);
