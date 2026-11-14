// Pure rules for Home's ambient sound (useHomeAmbientSound.ts). No React
// Native imports, so it is tested directly in Node (tests/home/home.test.cjs).

// The volume the sound settles at (0-1). Tune here.
export const AMBIENT_TARGET_VOLUME = 0.5;

// The fade-in from silence to AMBIENT_TARGET_VOLUME when Home comes into
// focus, and how often the volume is stepped during it.
export const FADE_IN_MS = 2000;
export const FADE_TICK_MS = 50;

// Volume `elapsedMs` after the sound starts: 0 at the start, the target at
// FADE_IN_MS and after, eased in and out (cosine) in between so there is no
// audible jump at either end.
export function fadeInVolume(elapsedMs: number, target: number = AMBIENT_TARGET_VOLUME): number {
  const t = Math.min(Math.max(elapsedMs / FADE_IN_MS, 0), 1);
  return target * 0.5 * (1 - Math.cos(Math.PI * t));
}
