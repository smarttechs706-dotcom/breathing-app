// Turns a session's audio schedule into one WAV track: for each phase, its
// tone plus its voice clip (from the phase start), the tone lowered while the
// voice speaks. The track is written in pieces through `write` (the header
// first, then one phase at a time), so a 10-minute track never sits in memory
// at once; phases that repeat (most breaths) are rendered once and reused.
// No React Native imports (tested in Node, tests/session/voiceMixer.test.cjs);
// writing to a file is the caller's (trackStore.ts, step 4).

import type { AudioSchedule, ScheduledPhase } from './schedule';
import { renderTone } from './tones';
import { dataBytesFor, HEADER_BYTES, msToSamples, samplesToBytes, SAMPLE_RATE, wavHeader, type WavClip } from './wav';

// The tone while the voice speaks: about -12 dB, with short ramps.
export const DUCK_GAIN = 0.25;
export const DUCK_RAMP_MS = 60;
// The voice clip as recorded (clips are peak-normalised when checked).
export const VOICE_GAIN = 1;

export type ClipSamples = Record<string, WavClip>;

export class ClipFormatError extends Error {}

// Every clip the schedule uses must exist and be at the track's rate.
export function checkClips(schedule: AudioSchedule, clips: ClipSamples, rate: number = SAMPLE_RATE): void {
  for (const ph of schedule.phases) {
    if (!ph.voice) continue;
    const clip = clips[ph.voice.clipId];
    if (!clip) throw new ClipFormatError(`missing clip ${ph.voice.clipId}`);
    if (clip.rate !== rate) throw new ClipFormatError(`clip ${ph.voice.clipId} is ${clip.rate} Hz, not ${rate} Hz`);
  }
}

// x is in 16-bit sample units (the voice as recorded plus the tone scaled to
// 32767), so a clip with no tone under it comes through unchanged.
function clamp16(x: number): number {
  const v = Math.round(x);
  return v > 32767 ? 32767 : v < -32768 ? -32768 : v;
}

// Gain on the tone at sample i when the voice covers [start, end).
function duckAt(i: number, start: number, end: number, ramp: number): number {
  if (end <= start) return 1;
  if (i < start - ramp || i >= end + ramp) return 1;
  if (i >= start && i < end) return DUCK_GAIN;
  const t = i < start ? (start - i) / ramp : (i - end + 1) / ramp; // 0 at the voice, 1 at the ramp edge
  return DUCK_GAIN + (1 - DUCK_GAIN) * Math.min(1, t);
}

// One phase as 16-bit samples, `samples` long.
export function mixPhase(ph: ScheduledPhase, samples: number, clips: ClipSamples, rate: number = SAMPLE_RATE): Int16Array {
  const tone = renderTone(ph.tone, samples, rate);
  const voice = ph.voice ? clips[ph.voice.clipId]?.samples : undefined;
  const voiceStart = ph.voice ? msToSamples(ph.voice.startMs - ph.startMs, rate) : 0;
  const voiceEnd = voice ? Math.min(samples, voiceStart + voice.length) : voiceStart;
  const ramp = Math.max(1, Math.round((DUCK_RAMP_MS * rate) / 1000));
  const out = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    let x = tone[i] * 32767 * (voice ? duckAt(i, voiceStart, voiceEnd, ramp) : 1);
    if (voice && i >= voiceStart && i < voiceEnd) x += VOICE_GAIN * voice[i - voiceStart];
    out[i] = clamp16(x);
  }
  return out;
}

// Same phase length, tone and clip: the same samples (reused).
function phaseKey(ph: ScheduledPhase, samples: number): string {
  const v = ph.voice;
  return `${samples}|${ph.tone ?? '-'}|${v ? `${v.clipId}@${v.startMs - ph.startMs}` : '-'}`;
}

export interface RenderResult {
  samples: number;
  bytes: number; // header + data, the file size
  rendered: number; // phases actually computed (the rest reused)
}

export function trackBytes(totalMs: number, rate: number = SAMPLE_RATE): number {
  return HEADER_BYTES + dataBytesFor(msToSamples(totalMs, rate));
}

// Writes the whole track through `write`: the header, then each phase. Each
// phase covers [msToSamples(start), msToSamples(end)), so the pieces add up to
// exactly msToSamples(totalMs) samples with no rounding drift.
export function renderTrack(
  schedule: AudioSchedule,
  clips: ClipSamples,
  write: (bytes: Uint8Array) => void,
  rate: number = SAMPLE_RATE
): RenderResult {
  checkClips(schedule, clips, rate);
  const total = msToSamples(schedule.totalMs, rate);
  write(wavHeader(dataBytesFor(total), rate));
  const cache = new Map<string, Uint8Array>();
  let written = 0;
  let rendered = 0;
  for (const ph of schedule.phases) {
    const start = msToSamples(ph.startMs, rate);
    const end = msToSamples(ph.startMs + ph.durationMs, rate);
    const n = end - start;
    const key = phaseKey(ph, n);
    let bytes = cache.get(key);
    if (!bytes) {
      bytes = samplesToBytes(mixPhase(ph, n, clips, rate));
      cache.set(key, bytes);
      rendered++;
    }
    write(bytes);
    written += n;
  }
  return { samples: written, bytes: HEADER_BYTES + dataBytesFor(written), rendered };
}
