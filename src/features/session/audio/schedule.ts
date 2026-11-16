// The audio schedule of a session: every phase from the start to the end of
// the last out-breath, with the voice clip (if any) and the tone for each.
// Built from the same pattern and sessionSeconds as the breathing circle, so
// each phase starts at exactly the time breathAt changes phase. The mixer
// (step 2) turns this into one audio track. No React Native imports (tested
// in Node, tests/session/voiceSchedule.test.cjs).

import { sessionSeconds, type BreathPattern } from '../breathPattern';
import { chooseVoice } from './fitRule';
import { cueClipId, sentenceClipId, VOICE_PHASES, type VoicePhase } from './voiceScript';

export type VoiceFrequency = 'every' | 'first3';

export interface AudioSettings {
  voice: boolean;
  tones: boolean;
  voiceFrequency: VoiceFrequency;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { voice: true, tones: true, voiceFrequency: 'every' };

// "First 3 breaths": the voice speaks in breaths 0, 1 and 2 only.
export const VOICE_FIRST_BREATHS = 3;

// Rising for in, falling for out, a quiet chime for hold, silence for rest.
export type ToneKind = 'rise' | 'fall' | 'chime';
const TONE: Record<VoicePhase, ToneKind | null> = { inhale: 'rise', hold: 'chime', exhale: 'fall', rest: null };

// Clip lengths in ms by clip id (from the clip manifest; synthetic in tests).
export type ClipDurations = Record<string, number>;

export interface ScheduledVoice {
  clipId: string;
  kind: 'sentence' | 'cue';
  startMs: number;
  durationMs: number;
}

export interface ScheduledPhase {
  breath: number; // 0, 1, 2... (one breath = in, hold, out, rest)
  phase: VoicePhase;
  startMs: number;
  durationMs: number;
  voice: ScheduledVoice | null;
  tone: ToneKind | null;
}

export interface AudioSchedule {
  totalMs: number; // sessionSeconds, in ms: the track length
  phases: ScheduledPhase[];
}

function seconds(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function voiceFor(
  phase: VoicePhase,
  phaseSec: number,
  phaseMs: number,
  startMs: number,
  durations: ClipDurations
): ScheduledVoice | null {
  const sentenceId = sentenceClipId(phase, phaseSec);
  const cueId = cueClipId(phase);
  const sentenceMs = sentenceId !== null ? (durations[sentenceId] ?? null) : null;
  const cueMs = durations[cueId] ?? null;
  const choice = chooseVoice(phaseMs, sentenceMs, cueMs);
  if (choice === 'sentence') return { clipId: sentenceId as string, kind: 'sentence', startMs, durationMs: sentenceMs as number };
  if (choice === 'cue') return { clipId: cueId, kind: 'cue', startMs, durationMs: cueMs as number };
  return null;
}

export function buildSchedule(
  pattern: BreathPattern,
  lengthSec: number,
  settings: AudioSettings,
  durations: ClipDurations
): AudioSchedule {
  const totalMs = Math.round(sessionSeconds(pattern, lengthSec) * 1000);
  const steps = VOICE_PHASES.map((phase) => ({ phase, sec: seconds(pattern[phase]) })).filter((s) => s.sec > 0);
  const phases: ScheduledPhase[] = [];
  if (totalMs <= 0 || steps.length === 0) return { totalMs: Math.max(0, totalMs), phases };

  let startMs = 0;
  for (let breath = 0; startMs < totalMs; breath++) {
    for (const { phase, sec } of steps) {
      if (startMs >= totalMs) break;
      const durationMs = Math.min(Math.round(sec * 1000), totalMs - startMs);
      const speaks = settings.voice && (settings.voiceFrequency === 'every' || breath < VOICE_FIRST_BREATHS);
      phases.push({
        breath,
        phase,
        startMs,
        durationMs,
        voice: speaks ? voiceFor(phase, sec, durationMs, startMs, durations) : null,
        tone: settings.tones ? TONE[phase] : null,
      });
      startMs += durationMs;
    }
  }
  return { totalMs, phases };
}
