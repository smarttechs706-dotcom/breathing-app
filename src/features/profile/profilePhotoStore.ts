import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import {
  PHOTO_FOLDER,
  PHOTO_QUALITY,
  PHOTO_SIZE,
  PICKER_OPTIONS,
  currentPhoto,
  removePhotos,
  savePhoto,
  type PhotoFs,
} from './profilePhoto';

// Native side of the Profile picture (rules in profilePhoto.ts). The copy
// lives in the app's private documents folder: other apps and the gallery
// cannot see it, and it is not backed up (app.json allowBackup: false).
// Nothing here is ever uploaded. Every failure is caught: the picture is a
// nicety, so the Profile screen just keeps showing the initial.

function folder(): Directory {
  return new Directory(Paths.document, PHOTO_FOLDER);
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
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true });
    const target = new File(dir, name);
    await new File(sourceUri).copy(target);
    return target.uri;
  },
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
// 512 x 512 JPEG and keeps it as this account's photo.
export async function chooseProfilePhoto(userId: string): Promise<ChooseResult> {
  try {
    const picked = await launchImageLibraryAsync(PICKER_OPTIONS);
    const asset = picked.canceled ? null : picked.assets?.[0];
    if (!asset) return { kind: 'canceled' };
    const image = await ImageManipulator.manipulate(asset.uri).resize({ width: PHOTO_SIZE }).renderAsync();
    const small = await image.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
    const uri = await savePhoto(fileSystem, userId, small.uri, Date.now());
    return uri ? { kind: 'saved', uri } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

// "Remove photo", a user-initiated sign out and "Delete my data". Never on the
// automatic sign-out after a session expires.
export function removeProfilePhoto(userId: string | null | undefined): void {
  try {
    removePhotos(fileSystem, userId);
  } catch {
    // Best effort: a file that can't be removed is only a few KB, private to the app.
  }
}
