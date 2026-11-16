import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Recipe } from './customPattern';
import { clearLast, loadLast, saveLast } from './lastPattern';

// The last custom pattern on this phone (rules in lastPattern.ts), in
// AsyncStorage. Nothing here throws.

// The editor's starting recipe: the stored one, else 4-0-6-0 at 5 min.
export function loadLastPattern(userId: string | null | undefined): Promise<Recipe> {
  return loadLast(AsyncStorage, userId);
}

// When a custom session's breathing reaches its end.
export function rememberLastPattern(userId: string | null | undefined, recipe: Recipe): Promise<boolean> {
  return saveLast(AsyncStorage, userId, recipe);
}

// Delete account only; sign-out keeps it.
export function clearLastPattern(userId: string | null | undefined): Promise<void> {
  return clearLast(AsyncStorage, userId);
}
