import AsyncStorage from '@react-native-async-storage/async-storage';

// Removes what old installs kept in AsyncStorage: the device id and the local
// name, both replaced by the account. Matches only these prefixes, so every
// other stored value stays. Safe to run on each launch, and a failure just
// means it runs again next time.
const LEGACY_PREFIXES = ['breathe_device_', 'breathe_user_'];

export async function removeLegacyIdentity(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter((key) =>
      LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix))
    );
    if (legacy.length > 0) await AsyncStorage.multiRemove(legacy);
  } catch {
    // Nothing reads these values any more, so leaving them is harmless.
  }
}
