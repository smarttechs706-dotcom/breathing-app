// The session's voice track on disk: written in pieces through the mixer to
// <cache>/breath-tracks/<16 hex>.wav, deleted when the session screen closes,
// and the whole folder deleted at app start (leftovers from a crash or a
// killed app). The file system is passed in (expo-file-system in
// trackFiles.ts), so every path, including the failures, is tested offline
// (tests/session/trackStore.test.cjs). Nothing here throws: a failure returns
// a result the screen uses to fall back to silent breathing, with its timing
// unchanged, and never leaves a file behind.

import { checkClips, renderTrack, type ClipSamples } from './mixer';
import type { AudioSchedule } from './schedule';

export const TRACK_FOLDER = 'breath-tracks';
const NAME = /^[0-9a-f]{16}\.wav$/;

// A file being written, one piece at a time, in order.
export interface TrackSink {
  write(bytes: Uint8Array): void;
  close(): void;
}

// What the store needs from the file system, inside TRACK_FOLDER.
export interface TrackFs {
  ensureFolder(): void;
  create(name: string): TrackSink; // a new, empty file (replacing one of that name)
  remove(name: string): void; // no error when it is already gone
  removeFolder(): void; // the folder and everything in it; no error when absent
  uriOf(name: string): string;
}

export type WriteTrackResult =
  | { ok: true; name: string; uri: string; bytes: number; samples: number }
  | { ok: false; reason: 'name' | 'empty' | 'clips' | 'storage' };

// A random file name: 16 lowercase hex characters and .wav. `random` returns
// 0 <= x < 1 (Math.random in the app; fixed in tests). Not a secret, only a
// name that two sessions never share.
export function newTrackName(random: () => number = Math.random): string {
  let hex = '';
  for (let i = 0; i < 16; i++) hex += Math.floor(random() * 16).toString(16);
  return `${hex}.wav`;
}

export function isTrackName(name: unknown): name is string {
  return typeof name === 'string' && NAME.test(name);
}

// Writes the whole track as `name`. On any failure the partly written file is
// closed and removed, and the reason is returned:
// - name: not a track name (nothing is touched);
// - empty: the schedule has no length (nothing to play);
// - clips: a clip is missing or at another rate (checked before the file is
//   created, so nothing is written);
// - storage: the folder, the file or a write failed.
export function writeTrack(
  fs: TrackFs,
  name: string,
  schedule: AudioSchedule,
  clips: ClipSamples
): WriteTrackResult {
  if (!isTrackName(name)) return { ok: false, reason: 'name' };
  if (!(schedule.totalMs > 0) || schedule.phases.length === 0) return { ok: false, reason: 'empty' };
  try {
    checkClips(schedule, clips);
  } catch {
    return { ok: false, reason: 'clips' };
  }

  let sink: TrackSink | null = null;
  try {
    fs.ensureFolder();
    sink = fs.create(name);
    const open = sink;
    const result = renderTrack(schedule, clips, (bytes) => open.write(bytes));
    sink = null;
    open.close();
    return { ok: true, name, uri: fs.uriOf(name), bytes: result.bytes, samples: result.samples };
  } catch {
    try {
      sink?.close();
    } catch {
      // Already closed or broken: removing it below is what matters.
    }
    try {
      fs.remove(name);
    } catch {
      // Could not remove: the folder is cleared at the next app start.
    }
    return { ok: false, reason: 'storage' };
  }
}

// When the session screen closes. true when the file is gone.
export function deleteTrack(fs: TrackFs, name: string | null | undefined): boolean {
  if (!isTrackName(name)) return false;
  try {
    fs.remove(name);
    return true;
  } catch {
    return false;
  }
}

// At app start: the whole folder (any leftover tracks). true when it is gone.
export function clearTracks(fs: TrackFs): boolean {
  try {
    fs.removeFolder();
    return true;
  } catch {
    return false;
  }
}
