import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../features/session/audio/schedule';

// Voice guidance on/off (Settings), saved on this phone like the reminder
// settings (src/utils/reminders.ts): one namespaced key, not per account. On by
// default. Nothing here throws: a missing, unreadable or broken stored value
// reads as the default. Kept on sign-out, cleared on Delete account
// (deleteMyData.ts).

export const AUDIO_SETTINGS_KEY = 'breathe_audio_settings_v1';

// The stored text, read back. Only { "voice": true | false } counts; anything
// else is the default.
export function parseAudioSettings(raw: string | null): AudioSettings {
  if (!raw) return DEFAULT_AUDIO_SETTINGS;
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === 'object' && typeof (v as { voice?: unknown }).voice === 'boolean') {
      return { voice: (v as { voice: boolean }).voice };
    }
  } catch {
    // Broken JSON: the default.
  }
  return DEFAULT_AUDIO_SETTINGS;
}

export async function getAudioSettings(): Promise<AudioSettings> {
  try {
    return parseAudioSettings(await AsyncStorage.getItem(AUDIO_SETTINGS_KEY));
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

// false when it could not be saved (the caller keeps the previous value).
export async function saveAudioSettings(settings: AudioSettings): Promise<boolean> {
  try {
    await AsyncStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ voice: settings.voice === true }));
    return true;
  } catch {
    return false;
  }
}

// Delete account only; sign-out keeps it.
export async function clearAudioSettings(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUDIO_SETTINGS_KEY);
  } catch {
    // Best effort, like the other local clears in deleteMyData.
  }
}
