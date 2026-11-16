// The voice guidance script: the exact sentence spoken at the start of each
// phase for its length in seconds, the four short cues, and the id of the
// pre-recorded clip for each. It is also the recording script: 40 sentences
// plus 4 cues, 44 clips (approved 2026-11-17). No React Native imports, so it
// is tested directly in Node (tests/session/voiceSchedule.test.cjs).
//
// Lengths covered (whole seconds): breathe in 2-10, hold 1-10, breathe out
// 2-12, rest 1-10, the editor's limits (a 0-second hold or rest is skipped, so
// it needs no clip). A phase outside these has no sentence and uses its cue.

export type VoicePhase = 'inhale' | 'hold' | 'exhale' | 'rest';

export const VOICE_PHASES: VoicePhase[] = ['inhale', 'hold', 'exhale', 'rest'];

export const SENTENCE_RANGES: Record<VoicePhase, { min: number; max: number }> = {
  inhale: { min: 2, max: 10 },
  hold: { min: 1, max: 10 },
  exhale: { min: 2, max: 12 },
  rest: { min: 1, max: 10 },
};

const NUMBER_WORDS = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

// Short cues, used when the full sentence does not fit the phase (fitRule.ts).
export const CUES: Record<VoicePhase, string> = {
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
  rest: 'Rest',
};

// Clip file stems: in-04, hold-07, out-08, rest-02; cue-in, cue-hold, ...
const STEM: Record<VoicePhase, string> = { inhale: 'in', hold: 'hold', exhale: 'out', rest: 'rest' };

export function hasSentence(phase: VoicePhase, seconds: number): boolean {
  const { min, max } = SENTENCE_RANGES[phase];
  return Number.isInteger(seconds) && seconds >= min && seconds <= max;
}

// "Breathe in slowly for four seconds", "Hold for one second". null when the
// length has no sentence.
export function sentence(phase: VoicePhase, seconds: number): string | null {
  if (!hasSentence(phase, seconds)) return null;
  const amount = `${NUMBER_WORDS[seconds]} ${seconds === 1 ? 'second' : 'seconds'}`;
  switch (phase) {
    case 'inhale':
      return `Breathe in slowly for ${amount}`;
    case 'hold':
      return `Hold for ${amount}`;
    case 'exhale':
      return `Breathe out slowly for ${amount}`;
    case 'rest':
      return `Rest for ${amount}`;
  }
}

export function sentenceClipId(phase: VoicePhase, seconds: number): string | null {
  return hasSentence(phase, seconds) ? `${STEM[phase]}-${String(seconds).padStart(2, '0')}` : null;
}

export function cueClipId(phase: VoicePhase): string {
  return `cue-${STEM[phase]}`;
}

export interface ClipSpec {
  id: string;
  text: string;
  kind: 'sentence' | 'cue';
  phase: VoicePhase;
}

// Every clip to record, in a stable order: sentences per phase, then cues.
export function allClips(): ClipSpec[] {
  const out: ClipSpec[] = [];
  for (const phase of VOICE_PHASES) {
    const { min, max } = SENTENCE_RANGES[phase];
    for (let s = min; s <= max; s++) {
      out.push({ id: sentenceClipId(phase, s) as string, text: sentence(phase, s) as string, kind: 'sentence', phase });
    }
  }
  for (const phase of VOICE_PHASES) out.push({ id: cueClipId(phase), text: CUES[phase], kind: 'cue', phase });
  return out;
}
