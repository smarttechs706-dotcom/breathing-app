// "Your patterns": the custom recipes (four numbers and a length) kept on this
// phone only, per account, newest first, at most 8, never the same recipe
// twice. A recipe is saved when its session reaches the end of the breathing,
// before the check-in, so a weak connection can't lose it. Kept on sign-out,
// cleared on Delete account (deleteMyData.ts).
//
// The storage is passed in (AsyncStorage in savedPatternsStore.ts), so these
// rules are tested directly in Node (tests/session/savedPatterns.test.cjs).
// Nothing here throws: a storage failure leaves the row empty or unchanged.

import type { BreathPattern } from './breathPattern';
import { isLengthOption, isValidCustomPattern, PHASES, type LengthSec } from './customPattern';

export interface SavedPattern {
  pattern: BreathPattern;
  lengthSec: LengthSec;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const MAX_SAVED_PATTERNS = 8;

// One key per account: the user id, lower case, letters, digits and hyphens.
// null for a missing or odd id, so nothing is read or written.
export function savedPatternsKey(userId: string | null | undefined): string | null {
  if (typeof userId !== 'string') return null;
  const id = userId.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return id.length >= 8 && id.length <= 64 ? `breathe_custom_patterns_v1:${id}` : null;
}

export function sameRecipe(a: SavedPattern, b: SavedPattern): boolean {
  return a.lengthSec === b.lengthSec && PHASES.every((phase) => a.pattern[phase] === b.pattern[phase]);
}

function isSavedPattern(v: unknown): v is SavedPattern {
  if (!v || typeof v !== 'object') return false;
  const item = v as Record<string, unknown>;
  return isValidCustomPattern(item.pattern) && isLengthOption(item.lengthSec);
}

// Only the four phases and the length are kept (no extra fields).
function clean(item: SavedPattern): SavedPattern {
  const { inhale, hold, exhale, rest } = item.pattern;
  return { pattern: { inhale, hold, exhale, rest }, lengthSec: item.lengthSec };
}

// The recipe at the front, any earlier copy of it removed, at most 8.
export function addSaved(list: readonly SavedPattern[], item: SavedPattern): SavedPattern[] {
  return [clean(item), ...list.filter((s) => !sameRecipe(s, item))].slice(0, MAX_SAVED_PATTERNS);
}

export function removeSaved(list: readonly SavedPattern[], item: SavedPattern): SavedPattern[] {
  return list.filter((s) => !sameRecipe(s, item));
}

// Edit: the card it was opened from is removed and the edited recipe goes to
// the front. Unchanged numbers and length leave the list exactly as it is.
export function replaceSaved(
  list: readonly SavedPattern[],
  from: SavedPattern,
  item: SavedPattern
): SavedPattern[] {
  if (sameRecipe(from, item)) return [...list];
  return addSaved(removeSaved(list, from), item);
}

// What was stored, read back: anything broken or out of the limits is
// dropped, duplicates are dropped (the first, newest, stays), at most 8.
export function parseSaved(raw: string | null): SavedPattern[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: SavedPattern[] = [];
  for (const v of data) {
    if (isSavedPattern(v) && !out.some((s) => sameRecipe(s, v))) out.push(clean(v));
  }
  return out.slice(0, MAX_SAVED_PATTERNS);
}

export async function loadSaved(storage: KeyValueStorage, userId: string | null | undefined): Promise<SavedPattern[]> {
  const key = savedPatternsKey(userId);
  if (!key) return [];
  try {
    return parseSaved(await storage.getItem(key));
  } catch {
    return [];
  }
}

// Read, change, write. Returns the new list, or null when it couldn't be
// written (the stored list is then unchanged).
async function update(
  storage: KeyValueStorage,
  userId: string | null | undefined,
  change: (list: SavedPattern[]) => SavedPattern[]
): Promise<SavedPattern[] | null> {
  const key = savedPatternsKey(userId);
  if (!key) return null;
  try {
    const next = change(parseSaved(await storage.getItem(key)));
    await storage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

// `from`: the card an Edit was opened from, which this recipe replaces.
export function rememberSaved(
  storage: KeyValueStorage,
  userId: string | null | undefined,
  item: SavedPattern,
  from?: SavedPattern | null
) {
  if (!isSavedPattern(item)) return Promise.resolve(null);
  return update(storage, userId, (list) => (from ? replaceSaved(list, from, item) : addSaved(list, item)));
}

export function forgetSaved(storage: KeyValueStorage, userId: string | null | undefined, item: SavedPattern) {
  return update(storage, userId, (list) => removeSaved(list, item));
}

export async function clearSaved(storage: KeyValueStorage, userId: string | null | undefined): Promise<void> {
  const key = savedPatternsKey(userId);
  if (!key) return;
  try {
    await storage.removeItem(key);
  } catch {
    // Best effort, like the other local clears in deleteMyData.
  }
}
