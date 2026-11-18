// Pure rule for whether a session gets a voice track at all. Playing it, and
// the voice-driven clock, are in voiceClock.ts. No React Native imports
// (tested in Node, tests/session/voicePlayer.test.cjs).

import type { BreathPattern } from '../breathPattern';
import type { ClipSamples } from './mixer';
import { buildSchedule, usesAudio, type AudioSchedule, type AudioSettings } from './schedule';
import type { VoiceClips } from './voiceClips';

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
