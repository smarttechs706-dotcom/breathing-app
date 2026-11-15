import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { deleteProfilePhoto, getProfilePhoto, putProfilePhoto } from '../../api/profilePhoto';
import {
  PHOTO_FOLDER,
  PHOTO_QUALITY,
  PHOTO_SIZE,
  PICKER_OPTIONS,
  SIGN_OUT_UPLOAD_WAIT_MS,
  currentPhoto,
  photoSyncKey,
  removePhotos,
  saveDownloadedPhoto,
  savePhoto,
  type PhotoFs,
} from './profilePhoto';
import {
  flushBeforeSignOut,
  forgetOnPhone,
  photoChosen,
  removeEverywhere,
  syncPhoto,
  type PhotoSyncDeps,
  type SyncResult,
} from './photoSync';

// Native side of the Profile picture (rules in profilePhoto.ts, order in
// photoSync.ts). The phone copy lives in the app's private documents folder:
// other apps and the gallery cannot see it, and it is not backed up (app.json
// allowBackup: false). The account's copy goes through our API only, never to
// Supabase directly. Every failure is caught: the picture is a nicety, so the
// Profile screen just keeps showing what it has.

function folder(): Directory {
  return new Directory(Paths.document, PHOTO_FOLDER);
}

function ensureFolder(): Directory {
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

const fileSystem: PhotoFs = {
  list() {
    const dir = folder();
    if (!dir.exists) return [];
    return dir
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((f) => ({ name: f.name, uri: f.uri }));
  },
  remove(name) {
    const file = new File(folder(), name);
    if (file.exists) file.delete();
  },
  async copyIn(sourceUri, name) {
    const target = new File(ensureFolder(), name);
    await new File(sourceUri).copy(target);
    return target.uri;
  },
  writeIn(bytes, name) {
    const target = new File(ensureFolder(), name);
    target.write(bytes);
    return target.uri;
  },
};

const syncDeps: PhotoSyncDeps = {
  hasLocal: (userId) => getProfilePhotoUri(userId) !== null,
  async localBytes(userId) {
    const uri = getProfilePhotoUri(userId);
    return uri ? new File(uri).bytes() : null;
  },
  saveDownloaded(userId, bytes) {
    try {
      return saveDownloadedPhoto(fileSystem, userId, bytes, Date.now()) !== null;
    } catch {
      return false;
    }
  },
  removeLocal: (userId) => removeProfilePhoto(userId),
  readState(userId) {
    const key = photoSyncKey(userId);
    return key ? AsyncStorage.getItem(key) : Promise.resolve(null);
  },
  async writeState(userId, state) {
    const key = photoSyncKey(userId);
    if (key) await AsyncStorage.setItem(key, JSON.stringify(state));
  },
  async clearState(userId) {
    const key = photoSyncKey(userId);
    if (key) await AsyncStorage.removeItem(key);
  },
  upload: (bytes) => putProfilePhoto(bytes),
  download: () => getProfilePhoto(),
  remove: () => deleteProfilePhoto(),
  now: () => Date.now(),
};

// This account's photo uri, or null (no photo, or the folder can't be read).
export function getProfilePhotoUri(userId: string | null | undefined): string | null {
  try {
    return currentPhoto(fileSystem, userId);
  } catch {
    return null;
  }
}

export type ChooseResult = { kind: 'saved'; uri: string } | { kind: 'canceled' } | { kind: 'failed' };

// Opens Android's photo picker (with its square crop), shrinks the result to
// 512 x 512 JPEG and keeps it as this account's photo, then uploads it quietly
// (a failed upload is retried when Profile opens).
export async function chooseProfilePhoto(userId: string): Promise<ChooseResult> {
  try {
    const picked = await launchImageLibraryAsync(PICKER_OPTIONS);
    const asset = picked.canceled ? null : picked.assets?.[0];
    if (!asset) return { kind: 'canceled' };
    const image = await ImageManipulator.manipulate(asset.uri).resize({ width: PHOTO_SIZE }).renderAsync();
    const small = await image.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
    const uri = await savePhoto(fileSystem, userId, small.uri, Date.now());
    if (!uri) return { kind: 'failed' };
    void photoChosen(syncDeps, userId);
    return { kind: 'saved', uri };
  } catch {
    return { kind: 'failed' };
  }
}

// Profile, when it opens: upload a waiting picture, or fetch the account's
// copy (after sign-in, or once a day). Never throws.
export function syncProfilePhoto(userId: string): Promise<SyncResult> {
  return syncPhoto(syncDeps, userId);
}

// "Remove photo": the account's copy first, then the phone copy. 'failed'
// means nothing was removed (no connection).
export function removeProfilePhotoEverywhere(userId: string): Promise<'removed' | 'failed'> {
  return removeEverywhere(syncDeps, userId);
}

// Before a user-initiated sign-out: 'unsaved' means a new picture could not be
// uploaded within a few seconds and would be lost.
export async function flushProfilePhotoBeforeSignOut(
  userId: string | null | undefined
): Promise<'ok' | 'unsaved'> {
  if (!userId) return 'ok';
  try {
    return await flushBeforeSignOut(syncDeps, userId, SIGN_OUT_UPLOAD_WAIT_MS);
  } catch {
    return 'unsaved';
  }
}

// A user-initiated sign out and Delete account: forget the picture on this
// phone (file and sync state). Never on the automatic sign-out after a session
// expires.
export async function forgetProfilePhoto(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  await forgetOnPhone(syncDeps, userId);
}

// The phone copy only (used by the sync when the account's copy is gone).
export function removeProfilePhoto(userId: string | null | undefined): void {
  try {
    removePhotos(fileSystem, userId);
  } catch {
    // Best effort: a file that can't be removed is only a few KB, private to the app.
  }
}
