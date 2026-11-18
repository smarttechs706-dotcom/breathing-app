// Pure rules for the voice-driven session clock (voice step 6). With Voice
// guidance on and the track playing, the player's position is the session's
// one clock: phase, circle, timer and end all read it, so time with the screen
// off or the app in the background counts (it is observed through the
// player). With Voice guidance off, or no track, the existing session clock
// runs exactly as before (src/utils/sessionClock.ts: unobserved time never
// counts). No React Native imports (tested in Node,
// tests/session/voiceClock.test.cjs).

// The player's position as breathed time, never past the end of the session.
export function voiceElapsedMs(positionMs: number, endMs: number): number {
  const p = Number.isFinite(positionMs) && positionMs > 0 ? positionMs : 0;
  return Math.min(p, Math.max(0, endMs));
}

// The track counts as finished when the player said so, or when its position
// is within this much of the end (the last out-breath is over).
export const END_TOLERANCE_MS = 120;

export function trackFinished(positionMs: number, endMs: number, didJustFinish: boolean): boolean {
  return didJustFinish || (endMs > 0 && positionMs >= endMs - END_TOLERANCE_MS);
}

// What the player should do for what the session wants (breathing, not paused,
// the screen not covered by Settings). The app being in the background is not
// part of it: the voice keeps going with the screen off.
export function playerCommand(want: boolean, playing: boolean): 'play' | 'pause' | null {
  if (want && !playing) return 'play';
  if (!want && playing) return 'pause';
  return null;
}

// A command takes a moment to show in the player's state; differences within
// this time after our own play or pause are not someone else's doing.
export const COMMAND_GRACE_MS = 600;

// A play or pause that did not come from the app: the notification or lock
// screen buttons, a phone call or another app taking the audio (expo-audio
// pauses), and expo-audio resuming after a call. The screen's pause state
// follows it, so the circle and the pause button always agree with the voice.
export function externalChange(s: {
  wanted: boolean; // what the app last asked for
  playing: boolean;
  loaded: boolean;
  finished: boolean;
  msSinceCommand: number;
}): 'paused' | 'resumed' | null {
  if (!s.loaded || s.finished || s.msSinceCommand < COMMAND_GRACE_MS) return null;
  if (s.wanted && !s.playing) return 'paused';
  if (!s.wanted && s.playing) return 'resumed';
  return null;
}

// What the notification and lock screen show: the session's title and the
// app's name. No artwork (none passed), and play/pause only (no seeking).
export const LOCK_SCREEN_ARTIST = 'Breathease';
export const LOCK_SCREEN_OPTIONS = { showSeekForward: false, showSeekBackward: false } as const;

export function lockScreenMetadata(sessionTitle: string | null | undefined): { title: string; artist: string } {
  const title = typeof sessionTitle === 'string' && sessionTitle.trim() ? sessionTitle.trim() : LOCK_SCREEN_ARTIST;
  return { title, artist: LOCK_SCREEN_ARTIST };
}

// The audio mode while the voice plays: other apps pause (doNotMix), it keeps
// playing with the screen off or the app in the background, and it plays when
// the phone is on silent (the user turned Voice guidance on).
export const VOICE_AUDIO_MODE = {
  interruptionMode: 'doNotMix',
  shouldPlayInBackground: true,
  playsInSilentMode: true,
} as const;
