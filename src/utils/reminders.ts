import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// expo-notifications' native module isn't present in Expo Go on Android
// (SDK 53+) — importing it at module-load time crashes app startup there.
// Deferred to inside each function so the rest of the app still loads; a
// real dev-client/standalone build still gets full native functionality
// since the require just runs later, same as a top-level import would.
function notifications(): typeof import('expo-notifications') {
  return require('expo-notifications');
}

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
// expo-notifications only breaks in Expo Go on Android (SDK 53+) — iOS/web
// Expo Go are unaffected. Every exported function below that touches
// expo-notifications checks this first.
const notificationsUnavailable = isExpoGo && Platform.OS === 'android';

// architecture.md's "Notifications" section: daily reminder scheduled
// locally on-device, user-configurable time — no backend, no push token.
// Same AsyncStorage pattern as deviceId.ts/onboarding.ts (namespaced key,
// fail-open on error).
const REMINDER_SETTINGS_KEY = 'breathe_reminder_settings_v1';

export interface ReminderSettings {
  enabled: boolean;
  /** 0-23. null = no time has ever been chosen yet — never a fixed default. */
  hour: number | null;
  /** 0 | 15 | 30 | 45. null = no time has ever been chosen yet. */
  minute: number | null;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: null,
  minute: null,
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort — matches onboarding.ts's fail-open behavior.
  }
}

export type NotificationPermissionResult = 'granted' | 'denied' | 'unavailable';

export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  if (notificationsUnavailable) return 'unavailable';
  try {
    const Notifications = notifications();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return 'granted';
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

// Android requires a channel before a notification can display. No-op on
// iOS/web. Call once at app startup. Also no-ops in Expo Go, since this is
// the one call site invoked unconditionally on every mount
// (app/_layout.tsx) — the only path that could crash Expo Go at startup
// rather than only when the user actually opens Settings/onboarding.
export async function initNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || notificationsUnavailable) return;
  try {
    const Notifications = notifications();
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Daily reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // Best-effort — matches this module's existing fail-open pattern.
  }
}

// The single entry point both Settings and onboarding call after any
// enable/disable/time change. Always cancels every scheduled notification
// first, then schedules exactly one if enabled with a real time chosen —
// this is the whole mechanism preventing a changed time from also leaving
// the old time still firing (no per-notification id bookkeeping needed,
// since this app only ever schedules this one thing).
//
// No-ops entirely on web: expo-notifications' scheduling functions
// (cancelAllScheduledNotificationsAsync/scheduleNotificationAsync) throw
// UnavailabilityError there rather than being a harmless no-op — confirmed
// via the isolated web verification server (see PROGRESS.md). The
// preference itself still persists via AsyncStorage either way; only the
// OS-level scheduling call is skipped on a platform with no such OS.
export async function applyReminderSchedule(settings: ReminderSettings): Promise<void> {
  if (Platform.OS === 'web' || notificationsUnavailable) return;
  try {
    const Notifications = notifications();

    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!settings.enabled || settings.hour === null || settings.minute === null) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to breathe',
        body: 'Take a mindful pause with Breathe.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.hour,
        minute: settings.minute,
        channelId: 'default',
      },
    });
  } catch {
    // Best-effort — the preference itself already persisted via
    // AsyncStorage separately; only the OS-level scheduling call can throw.
    //
    // KNOWN BLIND SPOT (not fixed, documented 2026-09-29): this swallows every
    // error silently — a failed cancel/schedule leaves no log, no UI signal,
    // and no return value, so "enabled" in Settings can diverge from what is
    // actually scheduled. Diagnose with `adb shell dumpsys alarm` (look for
    // expo.modules.notifications.NOTIFICATION_EVENT) until this logs.
  }
}
