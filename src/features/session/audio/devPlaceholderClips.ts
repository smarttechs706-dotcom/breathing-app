// DEV-ONLY PLACEHOLDER: remove this file (and its one branch in voiceClips.ts)
// when the real voice clips land. Never ships: voiceClips.ts loads it only when
// __DEV__ is true (false in every release build, so the bundler drops the
// branch) AND EXPO_PUBLIC_VOICE_PLACEHOLDER=1 is set in .env.local (never sent
// to EAS). Tests guard both (tests/session/voicePlayer.test.cjs).
//
// The 44 clips made in memory, no audio files: a soft two-note pip (about
// 0.15 s, smooth fades) followed by silence, each clip as long as the real
// sentence would roughly be (70 ms per character), so the fit rule and the
// timing behave as with speech and every phase start is audible.

import type { ClipSamples } from './mixer';
import type { ClipDurations } from './schedule';
import { allClips } from './voiceScript';
import { msToSamples, SAMPLE_RATE } from './wav';

// Searched for in the release bundle export: must never be found there.
export const PLACEHOLDER_MARKER = 'breathease-dev-placeholder-voice';

const MS_PER_CHAR = 70;
const NOTE_MS = 75;
const NOTES_HZ = [660, 880];
const LEVEL = 0.2; // of full scale
const FADE_MS = 12;

function pip(samples: number, rate: number): Int16Array {
  const out = new Int16Array(samples);
  const note = msToSamples(NOTE_MS, rate);
  const fade = msToSamples(FADE_MS, rate);
  NOTES_HZ.forEach((hz, k) => {
    const start = k * note;
    for (let i = 0; i < note && start + i < samples; i++) {
      const edge = Math.min(i, note - 1 - i) / fade;
      const gain = edge >= 1 ? 1 : 0.5 * (1 - Math.cos(Math.PI * Math.max(0, edge)));
      out[start + i] = Math.round(32767 * LEVEL * gain * Math.sin((2 * Math.PI * hz * i) / rate));
    }
  });
  return out;
}

let cached: { clips: ClipSamples; durations: ClipDurations } | null = null;

export function placeholderVoiceClips(): { clips: ClipSamples; durations: ClipDurations; placeholder: true } {
  if (!cached) {
    const clips: ClipSamples = {};
    const durations: ClipDurations = {};
    for (const c of allClips()) {
      const samples = msToSamples(c.text.length * MS_PER_CHAR);
      clips[c.id] = { rate: SAMPLE_RATE, samples: pip(samples, SAMPLE_RATE) };
      durations[c.id] = (samples * 1000) / SAMPLE_RATE;
    }
    cached = { clips, durations };
  }
  return { ...cached, placeholder: true };
}
