import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearSaved,
  forgetSaved,
  loadSaved,
  rememberSaved,
  type SavedPattern,
} from './savedPatterns';

// "Your patterns" on this phone (rules in savedPatterns.ts), in AsyncStorage.
// Nothing here throws.

export function loadSavedPatterns(userId: string | null | undefined): Promise<SavedPattern[]> {
  return loadSaved(AsyncStorage, userId);
}

// When a custom session reaches its end.
export function rememberPattern(userId: string | null | undefined, item: SavedPattern) {
  return rememberSaved(AsyncStorage, userId, item);
}

// "Remove" on a card.
export function forgetPattern(userId: string | null | undefined, item: SavedPattern) {
  return forgetSaved(AsyncStorage, userId, item);
}

// Delete account only; sign-out keeps them.
export function clearSavedPatterns(userId: string | null | undefined): Promise<void> {
  return clearSaved(AsyncStorage, userId);
}
