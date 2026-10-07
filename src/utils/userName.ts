import AsyncStorage from '@react-native-async-storage/async-storage';

// TEMPORARY: a locally-stored display name for Home's greeting. v1 has no
// user accounts (architecture.md "Auth (v1)"), so this lives only in
// AsyncStorage on this device and is never sent to the backend. It is meant
// to be replaced once real accounts/authentication exist — keep it simple.
//
// Namespaced key, same reasoning as onboarding.ts and deviceId.ts: Expo Go's
// AsyncStorage isn't reliably sandboxed per-project on-device.
const USER_NAME_KEY = 'breathe_user_name_v1';

// Home's greeting sits in a fixed-height top bar next to the avatar and the
// settings icon, so a long name must stay bounded (Home also truncates to one
// line with an ellipsis as a second line of defense).
export const MAX_USER_NAME_LENGTH = 30;

/**
 * Trims, caps length, and rejects empty input. Returns the name that should
 * be stored, or null if the input isn't a valid name (empty / whitespace-only).
 * Pure — no storage access — so it can be checked on its own.
 */
export function normalizeUserName(raw: string): string | null {
  // Collapse line breaks to spaces first: the input is single-line, but a
  // pasted multi-line string would otherwise end up inside the greeting.
  const trimmed = raw.replace(/[\r\n]+/g, ' ').trim();
  if (trimmed.length === 0) return null;
  // Trim again after slicing so a cut that lands just after a space doesn't
  // leave a trailing space.
  return trimmed.slice(0, MAX_USER_NAME_LENGTH).trim();
}

export async function getUserName(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(USER_NAME_KEY);
    // Re-normalize on read so a bad value (older build, manual edit) can
    // never reach the greeting.
    return value === null ? null : normalizeUserName(value);
  } catch {
    // Unreadable storage: behave as "no name set" — the prompt shows, which
    // is harmless — rather than crash.
    return null;
  }
}

/**
 * Saves a normalized name. Returns the saved name, or null if the input was
 * invalid (nothing is written) or the write failed.
 */
export async function setUserName(raw: string): Promise<string | null> {
  const name = normalizeUserName(raw);
  if (name === null) return null;
  try {
    await AsyncStorage.setItem(USER_NAME_KEY, name);
    return name;
  } catch {
    return null;
  }
}

export async function clearUserName(): Promise<void> {
  await AsyncStorage.removeItem(USER_NAME_KEY);
}
