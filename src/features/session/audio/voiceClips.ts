import type { ClipSamples } from './mixer';
import type { ClipDurations } from './schedule';

// The one source of voice clips for a session. The voice is Azure
// en-US-CoraMultilingualNeural; its 44 clips are not generated yet, so this
// returns null and Voice guidance falls back to silent breathing with the
// existing timing.

export interface VoiceClips {
  clips: ClipSamples;
  durations: ClipDurations; // ms per clip id
  placeholder: boolean;
}

export function getVoiceClips(): VoiceClips | null {
  // DEV-ONLY PLACEHOLDER: remove this branch and devPlaceholderClips.ts when
  // the real clips land. __DEV__ is false in release builds, so the bundler
  // removes this branch and the file it loads; the env switch is set only in
  // .env.local (kept out of EAS uploads by .easignore).
  if (__DEV__ && process.env.EXPO_PUBLIC_VOICE_PLACEHOLDER === '1') {
    return require('./devPlaceholderClips').placeholderVoiceClips();
  }
  return null;
}
