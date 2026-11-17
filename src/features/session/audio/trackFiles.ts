import { Directory, File, Paths } from 'expo-file-system';

import type { ClipSamples } from './mixer';
import type { AudioSchedule } from './schedule';
import {
  clearTracks,
  deleteTrack,
  newTrackName,
  TRACK_FOLDER,
  writeTrack,
  type TrackFs,
  type WriteTrackResult,
} from './trackStore';

// The native side of the track store (rules in trackStore.ts):
// <cache>/breath-tracks, one file per session, written through a FileHandle
// one piece at a time. Every function catches, so none of them throws.

function folder(): Directory {
  return new Directory(Paths.cache, TRACK_FOLDER);
}

const nativeFs: TrackFs = {
  ensureFolder() {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  },
  create(name) {
    const file = new File(folder(), name);
    if (file.exists) file.delete();
    file.create();
    const handle = file.open(); // read-write, from the start
    return {
      write: (bytes) => handle.writeBytes(bytes),
      close: () => handle.close(),
    };
  },
  remove(name) {
    const file = new File(folder(), name);
    if (file.exists) file.delete();
  },
  removeFolder() {
    const dir = folder();
    if (dir.exists) dir.delete();
  },
  uriOf(name) {
    return new File(folder(), name).uri;
  },
};

// Bakes the session's track. On { ok: false } the session breathes silently
// with its existing timing.
export function writeBreathTrack(schedule: AudioSchedule, clips: ClipSamples): WriteTrackResult {
  return writeTrack(nativeFs, newTrackName(), schedule, clips);
}

// When the session screen closes.
export function deleteBreathTrack(name: string | null | undefined): boolean {
  return deleteTrack(nativeFs, name);
}

// At app start (app/_layout.tsx).
export function clearBreathTracks(): boolean {
  return clearTracks(nativeFs);
}
