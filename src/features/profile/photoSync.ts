// Keeps the Profile picture on this phone and the copy kept with the account
// (/api/profile-photo) in step. Every outside effect (files, the API, saved
// state, the clock) comes in through PhotoSyncDeps, so the order and the
// failure handling are tested in Node (tests/profile/photoSync.test.cjs). The
// native wiring is in profilePhotoStore.ts.
//
// Rules (approved plan, 2026-11-16):
// - A new picture is kept on the phone at once and uploaded quietly; a failed
//   upload keeps the phone copy and is retried when Profile opens.
// - Profile downloads the account's copy when this phone has not checked since
//   sign-in, or once a day. No copy online and nothing waiting to upload means
//   it was removed on another phone, so the phone copy goes too.
// - Remove photo needs the server: nothing is removed unless the account's
//   copy is gone, so a removed picture can never come back.
// - A user-initiated sign-out waits a few seconds for a pending upload and says
//   so if it still has not gone through.

import {
  nextPhotoSyncStep,
  parsePhotoSyncState,
  type PhotoSyncState,
} from './profilePhoto';

export interface PhotoSyncDeps {
  hasLocal(userId: string): boolean;
  // The phone copy's bytes, or null when there is none.
  localBytes(userId: string): Promise<Uint8Array | null>;
  // Keeps downloaded bytes as the phone copy; false if they could not be kept.
  saveDownloaded(userId: string, bytes: Uint8Array): boolean;
  removeLocal(userId: string): void;
  readState(userId: string): Promise<string | null>;
  writeState(userId: string, state: PhotoSyncState): Promise<void>;
  clearState(userId: string): Promise<void>;
  upload(bytes: Uint8Array): Promise<void>;
  // The account's copy, or null when it has none.
  download(): Promise<Uint8Array | null>;
  remove(): Promise<void>;
  now(): number;
}

export type SyncResult = 'unchanged' | 'uploaded' | 'downloaded' | 'removed-locally' | 'failed';

// One sync at a time per account; a second call joins the running one.
const running = new Map<string, Promise<SyncResult>>();

async function state(deps: PhotoSyncDeps, userId: string): Promise<PhotoSyncState> {
  let raw: string | null = null;
  try {
    raw = await deps.readState(userId);
  } catch {
    raw = null;
  }
  return parsePhotoSyncState(raw, deps.hasLocal(userId));
}

async function save(deps: PhotoSyncDeps, userId: string, next: PhotoSyncState): Promise<void> {
  try {
    await deps.writeState(userId, next);
  } catch {
    // The next sync works it out again from the files.
  }
}

async function runSync(deps: PhotoSyncDeps, userId: string): Promise<SyncResult> {
  const current = await state(deps, userId);
  const hasLocal = deps.hasLocal(userId);
  const step = nextPhotoSyncStep(current, hasLocal, deps.now());

  if (step === 'upload') {
    let bytes: Uint8Array | null = null;
    try {
      bytes = await deps.localBytes(userId);
    } catch {
      bytes = null;
    }
    if (!bytes) {
      // The phone copy is unreadable: stop waiting on it and check online next.
      await save(deps, userId, { pendingUpload: false, checkedAt: 0 });
      return 'failed';
    }
    try {
      await deps.upload(bytes);
    } catch {
      await save(deps, userId, { pendingUpload: true, checkedAt: current.checkedAt });
      return 'failed';
    }
    await save(deps, userId, { pendingUpload: false, checkedAt: deps.now() });
    return 'uploaded';
  }

  if (step === 'download') {
    let bytes: Uint8Array | null;
    try {
      bytes = await deps.download();
    } catch {
      return 'failed';
    }
    if (bytes) {
      if (!deps.saveDownloaded(userId, bytes)) return 'failed';
      await save(deps, userId, { pendingUpload: false, checkedAt: deps.now() });
      return 'downloaded';
    }
    // No copy online, and nothing waiting to upload (step would be 'upload').
    await save(deps, userId, { pendingUpload: false, checkedAt: deps.now() });
    if (hasLocal) {
      deps.removeLocal(userId);
      return 'removed-locally';
    }
    return 'unchanged';
  }

  return 'unchanged';
}

// Profile calls this when it opens; never throws.
export function syncPhoto(deps: PhotoSyncDeps, userId: string): Promise<SyncResult> {
  const already = running.get(userId);
  if (already) return already;
  const job = runSync(deps, userId)
    .catch((): SyncResult => 'failed')
    .finally(() => running.delete(userId));
  running.set(userId, job);
  return job;
}

// Called right after a new picture is kept on the phone: mark it to upload,
// then try at once. Never throws.
export async function photoChosen(deps: PhotoSyncDeps, userId: string): Promise<SyncResult> {
  await running.get(userId);
  const current = await state(deps, userId);
  await save(deps, userId, { pendingUpload: true, checkedAt: current.checkedAt });
  return syncPhoto(deps, userId);
}

// Remove photo: the account's copy first; the phone copy only once that is
// gone. Waits for a running upload, so it cannot put the picture back after.
export async function removeEverywhere(
  deps: PhotoSyncDeps,
  userId: string
): Promise<'removed' | 'failed'> {
  await running.get(userId);
  try {
    await deps.remove();
  } catch {
    return 'failed';
  }
  deps.removeLocal(userId);
  await save(deps, userId, { pendingUpload: false, checkedAt: deps.now() });
  return 'removed';
}

// Before a user-initiated sign-out: if a picture is waiting to upload, try for
// at most `waitMs`. 'unsaved' means it is still only on this phone. Never takes
// longer than `waitMs` (plus reading the state) and never throws.
export async function flushBeforeSignOut(
  deps: PhotoSyncDeps,
  userId: string,
  waitMs: number
): Promise<'ok' | 'unsaved'> {
  const current = await state(deps, userId);
  if (!(current.pendingUpload && deps.hasLocal(userId))) return 'ok';

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), waitMs);
  });
  try {
    const result = await Promise.race([syncPhoto(deps, userId), timeout]);
    return result === 'uploaded' ? 'ok' : 'unsaved';
  } finally {
    clearTimeout(timer);
  }
}

// User-initiated sign-out and Delete account: forget this account's picture
// on this phone (the file and the sync state). The account's copy stays for
// the next sign-in, or is deleted by the server with the account.
export async function forgetOnPhone(deps: PhotoSyncDeps, userId: string): Promise<void> {
  try {
    deps.removeLocal(userId);
  } catch {
    // Best effort; a few KB private to the app.
  }
  try {
    await deps.clearState(userId);
  } catch {
    // Best effort; with no file, the state only means "check online".
  }
}
