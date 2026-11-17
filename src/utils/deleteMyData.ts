import { Alert, Platform } from 'react-native';

import { deleteUserData } from '../api/client';
import { forgetProfilePhoto } from '../features/profile/profilePhotoStore';
import { clearLastPattern } from '../features/session/lastPatternStore';
import { clearAudioSettings } from '../state/audioSettings';
import { clearCachedSessions } from '../state/sessionsCache';
import { applyReminderSchedule, clearReminderSettings } from './reminders';

export const DELETE_TITLE = 'Delete your account?';
export const DELETE_MESSAGE =
  "This permanently deletes your account, session history, moods and streak from our server, and clears your name and reminder from this phone. It can't be undone, and there is no backup.";
export const DELETE_SUCCESS = 'Your account has been deleted.';
export const DELETE_FAILURE =
  "Couldn't delete your account. Check your connection and try again. Nothing was removed.";

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

export function showDeleted(onOk: () => void, note?: string): void {
  if (Platform.OS === 'web') {
    window.alert(note ? `${DELETE_SUCCESS}\n\n${note}` : DELETE_SUCCESS);
    onOk();
    return;
  }
  Alert.alert(DELETE_SUCCESS, note, [{ text: 'OK', onPress: onOk }], {
    cancelable: false,
  });
}

/**
 * 'deleted'                 everything is gone (server + this phone).
 * 'failed'                  the server delete failed; nothing local was touched.
 * 'reminder-not-cancelled'  server data and local data are gone, BUT the OS
 *                           daily reminder could not be cancelled, so the user
 *                           is told how to turn it off before signing out
 *                           (F-06, DEEP-AUDIT-3).
 */
export type DeleteResult = 'deleted' | 'failed' | 'reminder-not-cancelled';

export const DELETE_REMINDER_NOT_CANCELLED =
  "We couldn't turn off your daily reminder. You can turn off Breathease notifications in your phone's settings.";

/**
 * Deletes the signed-in account on the server, and ONLY if that succeeded
 * clears the local data. Local clears are best-effort individually so one
 * failing key can't stop the rest, and the server data is already gone by then.
 * The caller signs out afterwards: the token outlives the deleted account.
 * The onboarding flag stays, so this phone lands on Log in, not onboarding.
 */
export async function deleteMyData(userId?: string | null): Promise<DeleteResult> {
  try {
    await deleteUserData();
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
    // the next account on this phone sees it as on and can turn it off.
    ...(reminderCancelled ? [clearReminderSettings] : []),
    clearCachedSessions,
    // This account's Profile picture on this phone (file and sync state). The
    // account's copy was already deleted by the server, before the account.
    () => forgetProfilePhoto(userId),
    // This account's last custom pattern (phone only; sign-out keeps it).
    () => clearLastPattern(userId),
    // Voice guidance on/off (this phone; sign-out keeps it).
    clearAudioSettings,
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
