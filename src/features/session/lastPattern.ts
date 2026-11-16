// The last custom pattern: exactly one recipe per account (the four numbers and
// the length), on this phone only. Stored when a custom session's breathing
// reaches its end, independent of the check-in (app/session-player.tsx); the
// "Create your own" editor opens with it (app/create-pattern.tsx), or with
// 4-0-6-0 at 5 min when there is none or the stored value is broken. Library
// shows nothing about it. Kept on sign-out, cleared on Delete account
// (deleteMyData.ts).
//
// The storage is passed in (AsyncStorage in lastPatternStore.ts), so these
// rules are tested directly in Node (tests/session/lastPattern.test.cjs).
// Nothing here throws.

import {
  DEFAULT_CUSTOM_PATTERN,
  DEFAULT_LENGTH_SEC,
  isLengthOption,
  isValidCustomPattern,
  type Recipe,
} from './customPattern';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const DEFAULT_RECIPE: Recipe = { pattern: DEFAULT_CUSTOM_PATTERN, lengthSec: DEFAULT_LENGTH_SEC };

// One key per account: the user id, lower case, letters, digits and hyphens.
// null for a missing or odd id, so nothing is read or written.
export function lastPatternKey(userId: string | null | undefined): string | null {
  if (typeof userId !== 'string') return null;
  const id = userId.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return id.length >= 8 && id.length <= 64 ? `breathe_custom_last_v1:${id}` : null;
}

function isRecipe(v: unknown): v is Recipe {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return isValidCustomPattern(r.pattern) && isLengthOption(r.lengthSec);
}

// Only the four phases and the length are kept (no extra fields).
function clean(r: Recipe): Recipe {
  const { inhale, hold, exhale, rest } = r.pattern;
  return { pattern: { inhale, hold, exhale, rest }, lengthSec: r.lengthSec };
}

// What was stored, read back; null when missing, broken or out of the limits.
export function parseLast(raw: string | null): Recipe | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return isRecipe(v) ? clean(v) : null;
  } catch {
    return null;
  }
}

// The recipe the editor opens with: the stored one, else the default.
export async function loadLast(storage: KeyValueStorage, userId: string | null | undefined): Promise<Recipe> {
  const key = lastPatternKey(userId);
  if (!key) return DEFAULT_RECIPE;
  try {
    return parseLast(await storage.getItem(key)) ?? DEFAULT_RECIPE;
  } catch {
    return DEFAULT_RECIPE;
  }
}

// Replaces the stored recipe. false when invalid, no account, or not written.
export async function saveLast(
  storage: KeyValueStorage,
  userId: string | null | undefined,
  recipe: Recipe
): Promise<boolean> {
  const key = lastPatternKey(userId);
  if (!key || !isRecipe(recipe)) return false;
  try {
    await storage.setItem(key, JSON.stringify(clean(recipe)));
    return true;
  } catch {
    return false;
  }
}

export async function clearLast(storage: KeyValueStorage, userId: string | null | undefined): Promise<void> {
  const key = lastPatternKey(userId);
  if (!key) return;
  try {
    await storage.removeItem(key);
  } catch {
    // Best effort, like the other local clears in deleteMyData.
  }
}
