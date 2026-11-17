// Pure rules for playing the voice track with the session (step 5, foreground
// only): whether a session gets a track at all, and what the player should do
// at each clock update. The existing session clock stays in charge; the audio
// follows it (moved to the clock's position on every start or resume, and
// corrected when it drifts). No React Native imports (tested in Node,
// tests/session/voicePlayer.test.cjs).

import type { BreathPattern } from '../breathPattern';
import type { ClipSamples } from './mixer';
import { buildSchedule, usesAudio, type AudioSchedule, type AudioSettings } from './schedule';
import type { VoiceClips } from './voiceClips';

// The audio may drift this far from the clock before it is moved back.
export const DRIFT_MS = 250;

export type VoicePlan =
  | { kind: 'silent'; reason: 'off' | 'no-clips' | 'empty' }
  | { kind: 'voice'; schedule: AudioSchedule; clips: ClipSamples };

// Voice guidance off, or no clips: no track, the session breathes silently
// with its existing timing.
export function planVoice(
  settings: AudioSettings,
  clips: VoiceClips | null,
  pattern: BreathPattern,
  lengthSec: number
): VoicePlan {
  if (!usesAudio(settings)) return { kind: 'silent', reason: 'off' };
  if (!clips) return { kind: 'silent', reason: 'no-clips' };
  const schedule = buildSchedule(pattern, lengthSec, settings, clips.durations);
  if (!(schedule.totalMs > 0) || schedule.phases.length === 0) return { kind: 'silent', reason: 'empty' };
  return { kind: 'voice', schedule, clips: clips.clips };
}

export interface SyncState {
  want: boolean; // the session is breathing now (active, not paused, focused, foreground)
  playing: boolean;
  audioMs: number; // the player's position
  clockMs: number; // the session clock (breathed time)
}

export interface SyncStep {
  seekMs?: number;
  play?: boolean;
  pause?: boolean;
}

// What to do now. Starting or resuming always lines the audio up with the
// clock first; while playing, only a drift beyond DRIFT_MS moves it.
export function syncStep(s: SyncState): SyncStep {
  if (!s.want) return s.playing ? { pause: true } : {};
  const clock = Math.max(0, s.clockMs);
  if (!s.playing) return { seekMs: clock, play: true };
  if (Math.abs(s.audioMs - clock) > DRIFT_MS) return { seekMs: clock };
  return {};
}
