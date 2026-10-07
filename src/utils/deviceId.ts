import AsyncStorage from '@react-native-async-storage/async-storage';

// architecture.md's "Auth (v1)": no user accounts — a device-generated
// UUID stored in AsyncStorage on first launch, sent as `userId` in every
// API call. Didn't exist anywhere in this app yet (checked before wiring
// Session Player's checkin call, which needs it) — built here rather than
// assumed to already exist.
//
// Namespaced key, same reasoning as onboarding.ts's ONBOARDING_COMPLETE_KEY:
// Expo Go's AsyncStorage isn't reliably sandboxed per-project on-device.
const DEVICE_ID_KEY = 'breathe_device_id_v1';

// Plain Math.random()-based v4 UUID — adequate here since this is a local
// grouping identifier, not a security credential. Avoids adding a new
// dependency (e.g. expo-crypto) for a non-cryptographic need.
function generateUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }
    const fresh = generateUUIDv4();
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
    cachedDeviceId = fresh;
    return fresh;
  } catch {
    // AsyncStorage unavailable — fall back to an in-memory id rather than
    // crash. Won't persist across restarts if this happens, but lets the
    // current session's checkin calls still complete.
    if (!cachedDeviceId) cachedDeviceId = generateUUIDv4();
    return cachedDeviceId;
  }
}

// "Delete my data": forget this device's id so the next getDeviceId() mints a
// fresh one. Throws if the stored key can't be removed, so the caller doesn't
// report a reset that left the old id behind.
export async function clearDeviceId(): Promise<void> {
  await AsyncStorage.removeItem(DEVICE_ID_KEY);
  cachedDeviceId = null;
}
