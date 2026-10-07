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
 * Deletes this device's server data, and ONLY if that succeeded clears the
 * local data. Returns false (nothing local touched) if the server delete
 * failed. Local clears are best-effort individually so one failing key
 * can't stop the rest, and the server data is already gone by then.
 */
export async function deleteMyData(): Promise<boolean> {
  try {
    await deleteUserData(await getDeviceId());
  } catch {
    return false;
  }

  // Cancel the scheduled reminder first, then forget everything else.
  const clears: (() => Promise<unknown> | unknown)[] = [
    () => applyReminderSchedule({ enabled: false, hour: null, minute: null }),
    clearReminderSettings,
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
  return true;
}
