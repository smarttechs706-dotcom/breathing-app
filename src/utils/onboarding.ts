import AsyncStorage from '@react-native-async-storage/async-storage';

// architecture.md: "Auth (v1) — No user accounts. Device-generated UUID
// stored in AsyncStorage on first launch" already anticipates AsyncStorage
// as this app's local-persistence mechanism, so reusing it here for the
// onboarding-complete flag rather than introducing a second mechanism.
//
// Namespaced (not just 'onboarding_complete'): on-device testing found this
// exact generic key already set to "true" in AsyncStorage before this
// project's onboarding code had ever run on that device — Expo Go's
// AsyncStorage isn't reliably sandboxed per anonymous/local-URL project, so
// a plain, common key name can collide with an unrelated Expo Go project
// tested on the same phone. Prefixing avoids that collision class.
const ONBOARDING_COMPLETE_KEY = 'breathe_onboarding_complete_v1';

export async function getOnboardingComplete(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === 'true';
  } catch {
    // Fail open to showing onboarding again rather than crash or silently
    // treat an unreadable flag as "complete" (which would permanently hide
    // onboarding). Seeing onboarding twice is harmless; never seeing it is not.
    return false;
  }
}

export async function setOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  } catch {
    // Best-effort — if this fails, onboarding just shows again next launch.
  }
}
