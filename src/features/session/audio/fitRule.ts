// Which voice clip a phase gets: the full sentence when it fits inside the
// phase with a margin, else the short cue, else nothing. The voice never runs
// into the next phase. No React Native imports (tested in Node,
// tests/session/voiceSchedule.test.cjs).

// Silence left between the end of the clip and the next phase.
export const FIT_MARGIN_MS = 300;

export type VoiceChoice = 'sentence' | 'cue' | 'none';

// phaseMs: the phase length. sentenceMs / cueMs: the clip lengths, or null
// when that clip does not exist (no sentence for this length, or not in the
// clip manifest).
export function chooseVoice(phaseMs: number, sentenceMs: number | null, cueMs: number | null): VoiceChoice {
  const fits = (ms: number | null) => ms !== null && ms > 0 && ms + FIT_MARGIN_MS <= phaseMs;
  if (fits(sentenceMs)) return 'sentence';
  if (fits(cueMs)) return 'cue';
  return 'none';
}
