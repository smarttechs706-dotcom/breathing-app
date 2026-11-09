// Pure rules for the session player's painted background and mood icons
// (SessionBackdrop.tsx, MoodScale.tsx). No React Native imports, so it is
// tested directly in Node (tests/session/session.test.cjs).

export type PlayerPhase = 'pre-mood' | 'active' | 'post-mood';

// The painting is a 1080 x 600 centre crop (1.8 : 1) shown full width at the
// top of the screen.
export const PAINTING_ASPECT = 1.8;
// The lower part of the painting that fades into the navy background.
export const PAINTING_FADE_START = 0.55;
// Session content starts this far down the painting (over the fade).
export const CONTENT_START = 0.6;
// Height of the player's top bar (app/session-player.tsx styles.topBar).
export const TOP_BAR_HEIGHT = 64;

// How strongly the top painting shows in each phase: full before the session,
// dim while breathing so the orb stays the focus, most of the way back after.
const PAINTING_OPACITY: Record<PlayerPhase, number> = {
  'pre-mood': 1,
  active: 0.35,
  'post-mood': 0.8,
};

export function paintingOpacity(phase: PlayerPhase): number {
  return PAINTING_OPACITY[phase];
}

// Strength of the full-screen portrait painting in each phase: strong before
// the session, dim while breathing so the orb stays the focus, most of the
// way back on Session Complete.
const PORTRAIT_OPACITY: Record<PlayerPhase, number> = {
  'pre-mood': 0.8,
  active: 0.45,
  'post-mood': 0.7,
};

export function portraitOpacity(phase: PlayerPhase): number {
  return PORTRAIT_OPACITY[phase];
}

// Which painting shows, and how strongly, for a phase. A session with a
// portrait shows it full screen on every phase (crossfading between strengths)
// and never shows the top painting. Without a portrait, the top painting is
// the fallback.
export function backdropOpacities(
  phase: PlayerPhase,
  portrait: boolean
): { top: number; portrait: number } {
  if (portrait) return { top: 0, portrait: portraitOpacity(phase) };
  return { top: paintingOpacity(phase), portrait: 0 };
}

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

// Painting file per session id (in ./images). A session without an entry gets
// the plain navy background. Source PNGs stay in assets/design-reference/.
export const SESSION_IMAGE_FILES: Record<string, string> = {
  'deep-exhale': 'session-deep-exhale.jpg',
  'morning-reset': 'session-morning-reset.jpg',
  'calm-focus': 'session-calm-focus.jpg',
  'stress-relief': 'session-stress-relief.jpg',
  'wind-down': 'session-wind-down.jpg',
  'box-breathing': 'session-box-breathing.jpg',
};

export function hasSessionImage(sessionId: string | null): boolean {
  return sessionId !== null && sessionId in SESSION_IMAGE_FILES;
}

// Full-screen portrait painting per session id (in ./images), used only on the
// breathing screen. About 852 x 1846, native size of the PNGs in
// assets/design-reference/. A session without one keeps the top painting.
export const SESSION_PORTRAIT_FILES: Record<string, string> = {
  'deep-exhale': 'session-deep-exhale-portrait.jpg',
  'morning-reset': 'session-morning-reset-portrait.jpg',
  'calm-focus': 'session-calm-focus-portrait.jpg',
  'stress-relief': 'session-stress-relief-portrait.jpg',
  'wind-down': 'session-wind-down-portrait.jpg',
  'box-breathing': 'session-box-breathing-portrait.jpg',
};

export function hasSessionPortrait(sessionId: string | null): boolean {
  return sessionId !== null && sessionId in SESSION_PORTRAIT_FILES;
}
