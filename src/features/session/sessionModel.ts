// Pure rules for the session player's layout and mood icons
// (SessionBackdrop.tsx, MoodScale.tsx). No React Native imports, so it is
// tested directly in Node (tests/session/session.test.cjs).

export type PlayerPhase = 'pre-mood' | 'active' | 'post-mood';

// The top spacer keeps the height it had when a 1.8 : 1 painting sat at the
// top of the screen, so the player's content stays where it was.
export const PAINTING_ASPECT = 1.8;
// Session content starts this far down that area.
export const CONTENT_START = 0.6;
// Height of the player's top bar (app/session-player.tsx styles.topBar).
export const TOP_BAR_HEIGHT = 64;

export function paintingHeight(screenWidth: number): number {
  return screenWidth / PAINTING_ASPECT;
}

// Space to leave between the top bar and the content so the content starts
// CONTENT_START of the way down the painting. Never negative.
export function contentSpacer(screenWidth: number, topInset: number): number {
  return Math.max(0, Math.round(paintingHeight(screenWidth) * CONTENT_START - topInset - TOP_BAR_HEIGHT));
}

// Mood 1-5 (Stressed -> Calm) as weather: storm, rain, cloud, part sun, sun.
// Outline icons when not selected, filled icons when selected (Ionicons).
export const MOOD_ICONS: readonly { outline: string; filled: string }[] = [
  { outline: 'thunderstorm-outline', filled: 'thunderstorm' },
  { outline: 'rainy-outline', filled: 'rainy' },
  { outline: 'cloud-outline', filled: 'cloud' },
  { outline: 'partly-sunny-outline', filled: 'partly-sunny' },
  { outline: 'sunny-outline', filled: 'sunny' },
];

// The icon for a saved/selected mood value (clamped to 1-5), or null when no
// mood has been chosen yet.
export function moodIcon(mood: number | null, variant: 'outline' | 'filled'): string | null {
  if (mood === null) return null;
  const index = Math.min(Math.max(Math.round(mood), 1), MOOD_ICONS.length) - 1;
  return MOOD_ICONS[index][variant];
}
