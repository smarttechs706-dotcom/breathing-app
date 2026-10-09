import { Alert, Platform } from 'react-native';

import { deleteUserData } from '../api/client';
import { clearCachedSessions } from '../state/sessionsCache';
import { clearDeviceId, getDeviceId } from './deviceId';
import { clearOnboardingComplete } from './onboarding';
import { applyReminderSchedule, clearReminderSettings } from './reminders';
import { clearUserName } from './userName';

export const DELETE_TITLE = 'Delete all your data?';
export const DELETE_MESSAGE =
  "This permanently deletes your session history, moods and streak from our server, and clears your name and reminder from this phone. It can't be undone, and there is no backup.";
export const DELETE_SUCCESS = 'Your data has been deleted.';
export const DELETE_FAILURE =
  "Couldn't delete your data. Check your connection and try again. Nothing was removed.";

// react-native-web's Alert.alert is a no-op, so web (used for testing) falls
// back to the browser's own dialogs. Native uses Alert.alert.
export function confirmDelete(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${DELETE_TITLE}\n\n${DELETE_MESSAGE}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      DELETE_TITLE,
      DELETE_MESSAGE,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete everything', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export function showDeleted(onOk: () => void): void {
  if (Platform.OS === 'web') {
    window.alert(DELETE_SUCCESS);
    onOk();
    return;
  }
  Alert.alert(DELETE_SUCCESS, undefined, [{ text: 'OK', onPress: onOk }], {
    cancelable: false,
  });
}

/**
 * 'deleted'                 everything is gone (server + this phone).
 * 'failed'                  the server delete failed; nothing local was touched.
 * 'reminder-not-cancelled'  server data and local data are gone, BUT the OS
 *                           daily reminder could not be cancelled, so its
 *                           stored setting was kept so the user can switch it
 *                           off in Settings (F-06, DEEP-AUDIT-3).
 */
export type DeleteResult = 'deleted' | 'failed' | 'reminder-not-cancelled';

export const DELETE_REMINDER_NOT_CANCELLED =
  "Your data was deleted, but we couldn't turn off your daily reminder. Switch it off under Daily Reminder above.";

/**
 * Deletes this device's server data, and ONLY if that succeeded clears the
 * local data. Local clears are best-effort individually so one failing key
 * can't stop the rest, and the server data is already gone by then.
 */
export async function deleteMyData(): Promise<DeleteResult> {
  try {
    await deleteUserData(await getDeviceId());
  } catch {
    return 'failed';
  }

  // Cancel the scheduled reminder first. applyReminderSchedule never throws --
  // it returns { ok: false } -- so the result must be checked, otherwise a
  // failed cancel would leave the OS firing "Time to breathe" after the app
  // reports everything deleted.
  let reminderCancelled = false;
  try {
    const result = await applyReminderSchedule({ enabled: false, hour: null, minute: null });
    reminderCancelled = result.ok;
  } catch {
    reminderCancelled = false;
  }

  const clears: (() => Promise<unknown> | unknown)[] = [
    // Keep the stored reminder setting if the reminder is still scheduled, so
    // Settings keeps showing it as on and the user can turn it off.
    ...(reminderCancelled ? [clearReminderSettings] : []),
    clearUserName,
    clearDeviceId,
    clearOnboardingComplete,
    clearCachedSessions,
  ];
  for (const clear of clears) {
    try {
      await clear();
    } catch {
      // Keep going; see doc comment.
    }
  }
  return reminderCancelled ? 'deleted' : 'reminder-not-cancelled';
}
