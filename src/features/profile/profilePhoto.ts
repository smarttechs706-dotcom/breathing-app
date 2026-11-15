// Pure rules for the Profile picture. A copy lives on this phone, and the
// picture is also kept with the account through the API (/api/profile-photo;
// the order of uploads, downloads and removals is in photoSync.ts). No React
// Native or Expo imports, so it is tested directly in Node with a fake file
// system (tests/profile/profilePhoto.test.cjs). The native wiring (photo
// picker, resize, files) is in profilePhotoStore.ts.
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
  // Writes `bytes` into the folder as `name`; returns the new file's uri.
  writeIn(bytes: Uint8Array, name: string): string;
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
  removeOlder(fs, key, name);
  return uri;
}

// Keeps a picture downloaded from the account as this account's photo, and
// removes its older ones. Null when the id is unusable or the bytes are not a
// JPEG (nothing is written then).
export function saveDownloadedPhoto(
  fs: PhotoFs,
  userId: string,
  bytes: Uint8Array,
  stamp: number
): string | null {
  const key = photoKey(userId);
  if (!key || !isJpeg(bytes)) return null;
  const name = photoFileName(userId, stamp);
  const uri = fs.writeIn(bytes, name);
  removeOlder(fs, key, name);
  return uri;
}

function removeOlder(fs: PhotoFs, key: string, keep: string): void {
  for (const f of fs.list()) {
    if (f.name !== keep && stampOf(f.name, key) !== null) fs.remove(f.name);
  }
}

// Every JPEG starts with FF D8 FF (the API checks the same).
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

// --- Keeping the phone copy and the account's copy in step -----------------

// GET /api/profile-photo answers 200 in one of two ways, told apart by
// Content-Type: image/jpeg with the bytes, or application/json with exactly
// {"photo":null} when the account has no picture (the API's NO_PHOTO_BODY).
// Only that JSON reply means "no picture online". Anything else (another
// content type, another body, an HTML page, any 404, any other status, a
// network error) means "unknown", and the phone copy stays.

// The media type of a Content-Type header, lower case, without parameters
// ("application/json; charset=utf-8" -> "application/json").
export function mediaType(header: string | null): string {
  return (header ?? '').split(';')[0].trim().toLowerCase();
}

// Exactly {"photo":null}: one key, "photo", whose value is null.
export function isNoPhotoBody(text: string): boolean {
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const keys = Object.keys(v);
    return keys.length === 1 && keys[0] === 'photo' && (v as { photo: unknown }).photo === null;
  } catch {
    return false;
  }
}

// Profile checks the account's copy at most once a day (a picture replaced on
// another phone shows up here within a day).
export const PHOTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
// A user-initiated sign-out waits at most this long for a pending upload.
export const SIGN_OUT_UPLOAD_WAIT_MS = 5000;

// Per account, on this phone: whether the phone's picture still has to be
// uploaded, and when the account's copy was last checked (0 = not since this
// sign-in).
export type PhotoSyncState = { pendingUpload: boolean; checkedAt: number };

export function photoSyncKey(userId: string | null | undefined): string | null {
  const key = photoKey(userId);
  return key ? `breathe_photo_sync_v1:${key}` : null;
}

// No saved state means this account has not synced on this phone yet: either a
// fresh sign-in (no phone copy, so download) or a picture chosen before the
// cloud copy existed (a phone copy, so upload it).
export function parsePhotoSyncState(raw: string | null, hasLocal: boolean): PhotoSyncState {
  const fresh = { pendingUpload: hasLocal, checkedAt: 0 };
  if (raw === null) return fresh;
  try {
    const v = JSON.parse(raw) as Partial<PhotoSyncState> | null;
    if (
      v &&
      typeof v.pendingUpload === 'boolean' &&
      typeof v.checkedAt === 'number' &&
      Number.isFinite(v.checkedAt) &&
      v.checkedAt >= 0
    ) {
      return { pendingUpload: v.pendingUpload, checkedAt: v.checkedAt };
    }
  } catch {
    // Fall through.
  }
  return fresh;
}

export type PhotoSyncStep = 'upload' | 'download' | 'none';

// An upload waiting for a phone copy that still exists comes first; one whose
// phone copy is gone checks online instead. Otherwise the account's copy is
// checked when it never was since sign-in, a day has passed, or the clock went
// backwards.
export function nextPhotoSyncStep(state: PhotoSyncState, hasLocal: boolean, now: number): PhotoSyncStep {
  if (state.pendingUpload) return hasLocal ? 'upload' : 'download';
  if (state.checkedAt === 0 || now < state.checkedAt) return 'download';
  return now - state.checkedAt >= PHOTO_CHECK_INTERVAL_MS ? 'download' : 'none';
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
