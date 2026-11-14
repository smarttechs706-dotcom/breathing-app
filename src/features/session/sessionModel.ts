// Pure rules for the session player's background, layout and mood icons
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

// What the background shows in each phase:
// - before the session (pre-mood): the session's own portrait painting, 80%;
// - while breathing (active): no painting; the looping background video
//   under a navy scrim at 55%;
// - Session Complete (post-mood): the portrait again, 70%.
// The plain navy gradient is always underneath; a session without a
// portrait (or none yet: loading and error screens) shows only the navy.
const PORTRAIT_OPACITY: Record<PlayerPhase, number> = {
  'pre-mood': 0.8,
  active: 0,
  'post-mood': 0.7,
};
export const BREATHING_SCRIM = 0.55;

export function portraitOpacity(phase: PlayerPhase): number {
  return PORTRAIT_OPACITY[phase];
}

export interface BackdropLayers {
  portrait: number; // 0-1 strength of the portrait painting
  video: boolean; // the looping background video is on screen
  scrim: number; // 0-1 navy over the video
}

export function backdropLayers(phase: PlayerPhase, sessionId: string | null): BackdropLayers {
  if (sessionId === null) return { portrait: 0, video: false, scrim: 0 };
  const video = phase === 'active';
  return {
    portrait: hasSessionPortrait(sessionId) ? portraitOpacity(phase) : 0,
    video,
    scrim: video ? BREATHING_SCRIM : 0,
  };
}

// Portrait painting per session id (in ./images), about 852 x 1846, the
// native size of the PNGs in assets/design-reference/. A session without one
// shows the plain navy background before and after the session.
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
