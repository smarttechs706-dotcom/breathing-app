// The soft tones under the voice, generated in code (no tone files): a gentle
// rising sweep for the in-breath, a falling one for the out-breath, a quiet
// decaying chime for a hold, silence for rest. Each starts and ends at zero
// (raised-cosine fades), so phases join without clicks. Values are floats in
// -1..1; the mixer scales and adds the voice. No React Native imports (tested
// in Node, tests/session/voiceMixer.test.cjs).

import type { ToneKind } from './schedule';

// Loudness of the sweeps and the chime peak (of full scale). Kept low: the
// tones sit under the voice and must never feel louder than it.
export const TONE_LEVEL = 0.12;
export const CHIME_LEVEL = 0.08;
// Sweep range: a soft low tone, not a melody.
export const SWEEP_LOW_HZ = 196;
export const SWEEP_HIGH_HZ = 294;
// Chime: one bell-like tone with a quiet upper partial, decaying.
export const CHIME_HZ = 528;
export const CHIME_DECAY_S = 0.9;
// Fade in and out of every tone, so it starts and ends at silence.
export const FADE_MS = 120;

function fadeGain(i: number, n: number, fade: number): number {
  if (fade <= 0) return 1;
  const fromStart = i / fade;
  const fromEnd = (n - 1 - i) / fade;
  const t = Math.min(1, fromStart, fromEnd);
  return t <= 0 ? 0 : 0.5 * (1 - Math.cos(Math.PI * t));
}

// `samples` long, at `rate`. A kind of null (rest, or tones off) is silence.
export function renderTone(kind: ToneKind | null, samples: number, rate: number): Float32Array {
  const out = new Float32Array(Math.max(0, samples));
  const n = out.length;
  if (kind === null || n === 0) return out;
  const fade = Math.min(Math.round((FADE_MS * rate) / 1000), Math.floor(n / 2));

  if (kind === 'chime') {
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const decay = Math.exp(-t / CHIME_DECAY_S);
      const s = Math.sin(2 * Math.PI * CHIME_HZ * t) + 0.3 * Math.sin(2 * Math.PI * CHIME_HZ * 2.76 * t);
      out[i] = (CHIME_LEVEL / 1.3) * decay * s * fadeGain(i, n, fade);
    }
    return out;
  }

  // Sweep: the frequency moves smoothly (cosine) from one end of the range to
  // the other over the whole phase; the phase of the sine is accumulated, so
  // the pitch glides without jumps.
  const [from, to] = kind === 'rise' ? [SWEEP_LOW_HZ, SWEEP_HIGH_HZ] : [SWEEP_HIGH_HZ, SWEEP_LOW_HZ];
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const p = n > 1 ? i / (n - 1) : 0;
    const hz = from + (to - from) * 0.5 * (1 - Math.cos(Math.PI * p));
    out[i] = TONE_LEVEL * Math.sin(phase) * fadeGain(i, n, fade);
    phase += (2 * Math.PI * hz) / rate;
  }
  return out;
}
