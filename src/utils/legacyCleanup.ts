import AsyncStorage from '@react-native-async-storage/async-storage';

// Removes the id old installs kept in AsyncStorage. Matches only this prefix,
// so every other stored value stays. Safe to run on each launch, and a failure
// just means it runs again next time.
const LEGACY_PREFIX = 'breathe_device_';

export async function removeLegacyIdentity(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter((key) => key.startsWith(LEGACY_PREFIX));
    if (legacy.length > 0) await AsyncStorage.multiRemove(legacy);
  } catch {
    // Nothing reads this value any more, so leaving it is harmless.
  }
}
