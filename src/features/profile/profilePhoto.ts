// Pure rules for the Profile picture, stored on this phone only (never
// uploaded). No React Native or Expo imports, so it is tested directly in Node
// with a fake file system (tests/profile/profilePhoto.test.cjs). The native
// wiring (photo picker, resize, files) is in profilePhotoStore.ts.
//
// One folder, one small JPEG per account: "<account id>-<time>.jpg". A new
// file name on every save means the picture on screen never shows a stale
// cached copy. Only files that belong to the given account are ever read or
// removed, so another account on the same phone never sees this one's photo.

// The file system operations used here, on the profile photo folder.
export interface PhotoFs {
  list(): { name: string; uri: string }[];
  remove(name: string): void;
  // Copies `sourceUri` into the folder as `name`; returns the new file's uri.
  copyIn(sourceUri: string, name: string): Promise<string>;
}

// The saved copy: square, 512 x 512, JPEG at 70% quality (about 30-60 KB).
export const PHOTO_SIZE = 512;
export const PHOTO_QUALITY = 0.7;
export const PHOTO_FOLDER = 'profile-photo';

// Android's system photo picker: images only, one photo, its own square crop.
// No camera.
export const PICKER_OPTIONS = {
  mediaTypes: ['images'] as 'images'[],
  allowsEditing: true,
  aspect: [1, 1] as [number, number],
  allowsMultipleSelection: false,
  quality: 1,
};

// The rows of the "Profile picture" sheet (PhotoSheet.tsx), top to bottom.
// "Remove photo" only when there is a photo to remove.
export type PhotoSheetAction = 'choose' | 'remove' | 'cancel';
export interface PhotoSheetRow {
  action: PhotoSheetAction;
  label: string;
  icon: 'images-outline' | 'trash-outline' | 'close-outline';
  danger: boolean;
}

export function photoSheetRows(hasPhoto: boolean): PhotoSheetRow[] {
  return [
    { action: 'choose', label: 'Choose from gallery', icon: 'images-outline', danger: false },
    ...(hasPhoto
      ? [{ action: 'remove' as const, label: 'Remove photo', icon: 'trash-outline' as const, danger: true }]
      : []),
    { action: 'cancel', label: 'Cancel', icon: 'close-outline', danger: false },
  ];
}

// A safe file-name key for an account id (Supabase ids are UUIDs): lower case
// letters, digits and hyphens only. Empty for anything unusable, and then
// nothing is read, written or removed.
export function photoKey(userId: string | null | undefined): string {
  if (typeof userId !== 'string') return '';
  const key = userId.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return key.length >= 8 && key.length <= 64 ? key : '';
}

export function photoFileName(userId: string, stamp: number): string {
  return `${photoKey(userId)}-${Math.max(0, Math.floor(stamp))}.jpg`;
}

// The time stamp in one of this account's file names, or null if the file is
// not this account's photo.
function stampOf(name: string, key: string): number | null {
  if (!key || !name.startsWith(`${key}-`) || !name.endsWith('.jpg')) return null;
  const middle = name.slice(key.length + 1, -4);
  return /^\d+$/.test(middle) ? Number(middle) : null;
}

// This account's current photo (the newest of its files), or null.
export function currentPhoto(fs: PhotoFs, userId: string | null | undefined): string | null {
  const key = photoKey(userId);
  if (!key) return null;
  let best: { stamp: number; uri: string } | null = null;
  for (const f of fs.list()) {
    const stamp = stampOf(f.name, key);
    if (stamp !== null && (best === null || stamp > best.stamp)) best = { stamp, uri: f.uri };
  }
  return best ? best.uri : null;
}

// Saves a new photo for this account and removes its older ones. Returns the
// new photo's uri, or null when the account id is unusable.
export async function savePhoto(
  fs: PhotoFs,
  userId: string,
  sourceUri: string,
  stamp: number
): Promise<string | null> {
  const key = photoKey(userId);
  if (!key) return null;
  const name = photoFileName(userId, stamp);
  const uri = await fs.copyIn(sourceUri, name);
  for (const f of fs.list()) {
    if (f.name !== name && stampOf(f.name, key) !== null) fs.remove(f.name);
  }
  return uri;
}

// Removes every photo of this account ("Remove photo", sign out, delete).
// Other accounts' photos are left alone.
export function removePhotos(fs: PhotoFs, userId: string | null | undefined): number {
  const key = photoKey(userId);
  if (!key) return 0;
  let removed = 0;
  for (const f of fs.list()) {
    if (stampOf(f.name, key) !== null) {
      fs.remove(f.name);
      removed++;
    }
  }
  return removed;
}
