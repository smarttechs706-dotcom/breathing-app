// Turns a session's voice schedule into one WAV track: silence, with each
// phase's voice clip placed sample-exact at the phase start. The track is
// written in pieces through `write` (the header first, then one phase at a
// time), so a 10-minute track never sits in memory at once; phases that repeat
// (most breaths) are rendered once and reused. No React Native imports (tested
// in Node, tests/session/voiceMixer.test.cjs); writing to a file is the
// caller's (trackStore.ts, step 4). Voice only for now (no tones, 2026-11-17).

import type { AudioSchedule, ScheduledPhase } from './schedule';
import { dataBytesFor, HEADER_BYTES, msToSamples, samplesToBytes, SAMPLE_RATE, wavHeader, type WavClip } from './wav';

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

// One phase as 16-bit samples, `samples` long: silence, with the voice clip
// copied in unchanged from its start (cut at the phase end, which the fit rule
// already prevents).
export function mixPhase(ph: ScheduledPhase, samples: number, clips: ClipSamples, rate: number = SAMPLE_RATE): Int16Array {
  const out = new Int16Array(samples);
  const voice = ph.voice ? clips[ph.voice.clipId]?.samples : undefined;
  if (ph.voice && voice) {
    const at = msToSamples(ph.voice.startMs - ph.startMs, rate);
    const count = Math.max(0, Math.min(voice.length, samples - at));
    if (at >= 0 && count > 0) out.set(voice.subarray(0, count), at);
  }
  return out;
}

// Same phase length and clip: the same samples (reused).
function phaseKey(ph: ScheduledPhase, samples: number): string {
  const v = ph.voice;
  return `${samples}|${v ? `${v.clipId}@${v.startMs - ph.startMs}` : '-'}`;
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
