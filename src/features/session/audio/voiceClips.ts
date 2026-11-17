import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import type { ClipSamples } from './mixer';
import type { ClipDurations } from './schedule';
import { VOICE_ASSETS } from './voiceAssets';
import { allClips } from './voiceScript';
import { parseWav, SAMPLE_RATE } from './wav';

// The one source of voice clips for a session: the 44 Azure
// en-US-CoraMultilingualNeural clips bundled with the app (assets/audio/voice,
// listed in voiceAssets.ts), read into samples. If any clip cannot be loaded,
// there are no clips and Voice guidance falls back to silent breathing with
// the existing timing. Nothing here throws.

export interface VoiceClips {
  clips: ClipSamples;
  durations: ClipDurations; // ms per clip id
  placeholder: boolean;
}

// True when the app bundles real clips.
export const HAS_REAL_CLIPS = Object.keys(VOICE_ASSETS).length > 0;

// All 44 clips from their WAV bytes, or null if any is missing or is not a
// 16-bit mono 22.05 kHz WAV (a session never plays with a gap in its voice).
export function clipsFromBytes(bytesById: Record<string, Uint8Array | null | undefined>): VoiceClips | null {
  const clips: ClipSamples = {};
  const durations: ClipDurations = {};
  for (const { id } of allClips()) {
    const bytes = bytesById[id];
    const parsed = bytes ? parseWav(bytes) : null;
    if (!parsed || parsed.rate !== SAMPLE_RATE || parsed.samples.length === 0) return null;
    clips[id] = parsed;
    durations[id] = (parsed.samples.length * 1000) / SAMPLE_RATE;
  }
  return { clips, durations, placeholder: false };
}

// A bundled clip's bytes (copied to the app's cache by expo-asset when needed).
async function readBundled(module: number): Promise<Uint8Array | null> {
  try {
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    return uri ? await new File(uri).bytes() : null;
  } catch {
    return null;
  }
}

// Loaded once per app run on success; a failure is retried next session.
let loaded: VoiceClips | null = null;

export async function loadVoiceClips(read: (module: number) => Promise<Uint8Array | null> = readBundled): Promise<VoiceClips | null> {
  // DEV-ONLY PLACEHOLDER: remove this branch and devPlaceholderClips.ts. It
  // applies only in a development build, with EXPO_PUBLIC_VOICE_PLACEHOLDER=1
  // (set only in .env.local, which EAS never receives), and only while the app
  // bundles no real clips. __DEV__ comes first: it is false in release builds,
  // so the bundler removes this branch and the file it loads.
  if (__DEV__ && process.env.EXPO_PUBLIC_VOICE_PLACEHOLDER === '1' && !HAS_REAL_CLIPS) {
    return require('./devPlaceholderClips').placeholderVoiceClips();
  }
  if (!HAS_REAL_CLIPS) return null;
  if (loaded) return loaded;
  try {
    const entries = await Promise.all(Object.entries(VOICE_ASSETS).map(async ([id, module]) => [id, await read(module)] as const));
    loaded = clipsFromBytes(Object.fromEntries(entries));
    return loaded;
  } catch {
    return null;
  }
}
