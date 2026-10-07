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

// Android channel settings (sound/importance/vibration) can't be changed in
// code once a channel exists on a device, so the original 'default' channel
// (importance 3, no vibration) is left alone and reminders use this new one.
const REMINDER_CHANNEL_ID = 'reminder-v2';

/** Shown on the Settings reminder card and the onboarding reminder screen. */
export const REMINDER_TIP =
  'For on-time reminders, set Battery to No restrictions for Breathe and keep notification volume on.';

export type ApplyReminderResult = { ok: true } | { ok: false; error: string };

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
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Daily reminder',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (err) {
    console.warn('[reminders] channel setup failed', err);
    return;
  }
  // Installs that scheduled a reminder before this channel existed still have
  // a DAILY trigger pointing at the old 'default' channel. Re-applying the
  // saved schedule moves it to the new channel. applyReminderSchedule cancels
  // everything first, so this can never leave two reminders scheduled.
  const saved = await getReminderSettings();
  if (saved.enabled) await applyReminderSchedule(saved);
}

// Without a handler, expo-notifications does NOT present a notification that
// arrives while the app is in the foreground — confirmed on-device
// 2026-09-29: a reminder that fired with Settings open was never posted,
// while backgrounded/killed-app fires were. Same expo-go/web guards as
// initNotificationChannel; call once at startup.
export function initNotificationHandler(): void {
  if (Platform.OS === 'web' || notificationsUnavailable) return;
  try {
    notifications().setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
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
export async function applyReminderSchedule(
  settings: ReminderSettings
): Promise<ApplyReminderResult> {
  if (Platform.OS === 'web' || notificationsUnavailable) return { ok: true };
  try {
    const Notifications = notifications();

    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!settings.enabled || settings.hour === null || settings.minute === null) {
      return { ok: true };
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
        channelId: REMINDER_CHANNEL_ID,
      },
    });
    return { ok: true };
  } catch (err) {
    // Callers only save the preference / show the new time when this is ok,
    // so "enabled" in Settings can't diverge from what is actually scheduled.
    console.warn('[reminders] schedule failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to schedule the reminder.',
    };
  }
}

export async function clearReminderSettings(): Promise<void> {
  await AsyncStorage.removeItem(REMINDER_SETTINGS_KEY);
}
