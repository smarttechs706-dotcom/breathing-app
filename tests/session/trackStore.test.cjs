// Tests for the voice track store (step 4): file naming, the track written in
// pieces in order, cleanup when the session closes and at app start, every
// failure path, and no file left behind after a failed write
// (src/features/session/audio/trackStore.ts), plus source checks of the
// native side and its wiring. Offline: an in-memory file system, synthetic
// beep clips, no network, no audio files.
// Run with:
//   node --test tests/session/trackStore.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
const bp = loadTs('src/features/session/breathPattern.ts');
const vs = loadTs('src/features/session/audio/voiceScript.ts');
const fit = loadTs('src/features/session/audio/fitRule.ts');
const sch = loadTs('src/features/session/audio/schedule.ts', {
  stubs: { '../breathPattern': bp, './fitRule': fit, './voiceScript': vs },
});
const wav = loadTs('src/features/session/audio/wav.ts');
const mix = loadTs('src/features/session/audio/mixer.ts', { stubs: { './wav': wav } });
const ts = loadTs('src/features/session/audio/trackStore.ts', { stubs: { './mixer': mix } });

const P = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });
const DURATIONS = Object.fromEntries(vs.allClips().map((c) => [c.id, c.text.length * 70]));
function beep(ms) {
  const n = wav.msToSamples(ms);
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.round(12000 * Math.sin((2 * Math.PI * 800 * i) / wav.SAMPLE_RATE));
  return { rate: wav.SAMPLE_RATE, samples: s };
}
const CLIPS = Object.fromEntries(Object.entries(DURATIONS).map(([id, ms]) => [id, beep(ms)]));
const SCHEDULE = sch.buildSchedule(P(4, 7, 8, 0), 120, { voice: true }, DURATIONS);
const NAME = '0123456789abcdef.wav';

// An in-memory breath-tracks folder that records every call and can fail at
// a chosen step.
function memFs(fail = {}) {
  const files = new Map(); // name -> { chunks, closed }
  const ops = [];
  let folder = false;
  let writes = 0;
  const api = {
    files,
    ops,
    get folder() {
      return folder;
    },
    ensureFolder() {
      ops.push('ensureFolder');
      if (fail.ensureFolder) throw new Error('no folder');
      folder = true;
    },
    create(name) {
      ops.push(`create ${name}`);
      if (fail.create) throw new Error('cannot create');
      const file = { chunks: [], closed: false };
      files.set(name, file);
      return {
        write(bytes) {
          writes++;
          ops.push(`write ${bytes.length}`);
          if (fail.writeAt === writes) throw new Error('disk full');
          file.chunks.push(bytes.slice());
        },
        close() {
          ops.push('close');
          if (fail.close) throw new Error('cannot close');
          file.closed = true;
        },
      };
    },
    remove(name) {
      ops.push(`remove ${name}`);
      if (fail.remove) throw new Error('cannot remove');
      files.delete(name);
    },
    removeFolder() {
      ops.push('removeFolder');
      if (fail.removeFolder) throw new Error('cannot remove folder');
      files.clear();
      folder = false;
    },
    uriOf(name) {
      return `file:///cache/breath-tracks/${name}`;
    },
  };
  return api;
}

const joined = (chunks) => {
  const out = new Uint8Array(chunks.reduce((t, c) => t + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};

// --- Naming --------------------------------------------------------------------

test('names: 16 lowercase hex characters and .wav, from the random source', () => {
  assert.equal(ts.TRACK_FOLDER, 'breath-tracks');
  let i = 0;
  const seq = [0, 0.0625, 0.5, 0.9999];
  const name = ts.newTrackName(() => seq[i++ % seq.length]);
  assert.equal(name, '018f018f018f018f.wav');
  for (let k = 0; k < 200; k++) assert.ok(ts.isTrackName(ts.newTrackName()));
  const many = new Set(Array.from({ length: 500 }, () => ts.newTrackName()));
  assert.equal(many.size, 500, 'no two sessions share a name');
  for (const bad of ['../x.wav', '0123456789ABCDEF.wav', '0123456789abcdef.mp3', 'abc.wav', '', null, undefined, 42, '0123456789abcdef.wav/..']) {
    assert.equal(ts.isTrackName(bad), false, String(bad));
  }
});

// --- Writing --------------------------------------------------------------------

test('write: folder, file, header and each phase in order, then close; the bytes are the mixer output', () => {
  const m = memFs();
  const r = ts.writeTrack(m, NAME, SCHEDULE, CLIPS);
  assert.equal(r.ok, true);
  assert.equal(r.name, NAME);
  assert.equal(r.uri, `file:///cache/breath-tracks/${NAME}`);
  assert.deepEqual(m.ops.slice(0, 2), ['ensureFolder', `create ${NAME}`]);
  assert.equal(m.ops[m.ops.length - 1], 'close');
  assert.equal(m.ops.filter((o) => o.startsWith('write')).length, 1 + SCHEDULE.phases.length, 'header + one per phase');
  assert.equal(m.ops[2], 'write 44', 'the header first');
  // Exactly what the mixer renders, in the same order.
  const expected = [];
  mix.renderTrack(SCHEDULE, CLIPS, (b) => expected.push(b.slice()));
  const file = m.files.get(NAME);
  assert.equal(file.closed, true);
  assert.deepEqual([...joined(file.chunks)], [...joined(expected)]);
  assert.equal(r.bytes, joined(file.chunks).length);
  assert.equal(r.samples, wav.msToSamples(SCHEDULE.totalMs));
  assert.equal(wav.parseWav(joined(file.chunks)).samples.length, r.samples, 'a valid WAV');
});

test('write: a bad name or an empty schedule touches nothing', () => {
  const m = memFs();
  assert.deepEqual(ts.writeTrack(m, '../evil.wav', SCHEDULE, CLIPS), { ok: false, reason: 'name' });
  assert.deepEqual(ts.writeTrack(m, NAME, { totalMs: 0, phases: [] }, CLIPS), { ok: false, reason: 'empty' });
  assert.deepEqual(m.ops, []);
});

test('write: a missing clip is refused before any file is created', () => {
  const m = memFs();
  const missing = { ...CLIPS };
  delete missing['out-08'];
  assert.deepEqual(ts.writeTrack(m, NAME, SCHEDULE, missing), { ok: false, reason: 'clips' });
  assert.deepEqual(m.ops, [], 'no folder, no file');
});

test('write failures: never throw, report storage, and leave no file behind', () => {
  const cases = {
    'folder cannot be made': { ensureFolder: true },
    'file cannot be created': { create: true },
    'header write fails': { writeAt: 1 },
    'a later write fails (disk full)': { writeAt: 4 },
    'the last write fails': { writeAt: 1 + SCHEDULE.phases.length },
    'close fails': { close: true },
  };
  for (const [label, fail] of Object.entries(cases)) {
    const m = memFs(fail);
    let r;
    assert.doesNotThrow(() => (r = ts.writeTrack(m, NAME, SCHEDULE, CLIPS)), label);
    assert.deepEqual(r, { ok: false, reason: 'storage' }, label);
    assert.equal(m.files.has(NAME), false, `${label}: no file left`);
    if (!fail.ensureFolder) assert.ok(m.ops.includes(`remove ${NAME}`), `${label}: removed`);
  }
  // A failed write closes the file before removing it.
  const m = memFs({ writeAt: 3 });
  ts.writeTrack(m, NAME, SCHEDULE, CLIPS);
  assert.deepEqual(m.ops.slice(-2), ['close', `remove ${NAME}`]);
});

test('write failures: even when the cleanup itself fails, nothing throws', () => {
  const m = memFs({ writeAt: 2, close: true, remove: true });
  let r;
  assert.doesNotThrow(() => (r = ts.writeTrack(m, NAME, SCHEDULE, CLIPS)));
  assert.deepEqual(r, { ok: false, reason: 'storage' });
  // The file could not be removed: the app-start cleanup takes the folder.
  assert.equal(ts.clearTracks(m), true);
  assert.equal(m.files.size, 0);
});

// --- Cleanup ------------------------------------------------------------------

test('cleanup on close: the file is deleted; a missing or bad name does nothing; never throws', () => {
  const m = memFs();
  ts.writeTrack(m, NAME, SCHEDULE, CLIPS);
  assert.equal(ts.deleteTrack(m, NAME), true);
  assert.equal(m.files.has(NAME), false);
  const before = m.ops.length;
  assert.equal(ts.deleteTrack(m, null), false, 'no track baked');
  assert.equal(ts.deleteTrack(m, '../x.wav'), false);
  assert.equal(m.ops.length, before, 'nothing touched');
  assert.equal(ts.deleteTrack(memFs({ remove: true }), NAME), false);
});

test('cleanup at app start: the whole folder goes; never throws', () => {
  const m = memFs();
  ts.writeTrack(m, NAME, SCHEDULE, CLIPS);
  ts.writeTrack(m, 'fedcba9876543210.wav', SCHEDULE, CLIPS);
  assert.equal(m.files.size, 2);
  assert.equal(ts.clearTracks(m), true);
  assert.equal(m.files.size, 0);
  assert.equal(m.folder, false);
  assert.equal(ts.clearTracks(memFs({ removeFolder: true })), false);
});

// --- Native side and wiring (source checks) ----------------------------------

test('native side: <cache>/breath-tracks, one handle written in pieces, every call caught', () => {
  const src = read('src/features/session/audio/trackFiles.ts');
  assert.ok(src.includes("import { Directory, File, Paths } from 'expo-file-system';"));
  assert.ok(src.includes('return new Directory(Paths.cache, TRACK_FOLDER);'));
  assert.ok(src.includes('dir.create({ intermediates: true, idempotent: true });'));
  assert.ok(src.includes('const handle = file.open();'));
  assert.ok(src.includes('write: (bytes) => handle.writeBytes(bytes),'));
  assert.ok(src.includes('close: () => handle.close(),'));
  assert.ok(src.includes('return writeTrack(nativeFs, newTrackName(), schedule, clips);'));
  assert.ok(src.includes('return deleteTrack(nativeFs, name);'));
  assert.ok(src.includes('return clearTracks(nativeFs);'));
  // Only the store's catching functions are exported: nothing here throws.
  const exported = [...src.matchAll(/export function (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(exported, ['writeBreathTrack', 'deleteBreathTrack', 'clearBreathTracks']);
  // Offline only.
  for (const f of ['trackFiles.ts', 'trackStore.ts']) {
    const s = read(`src/features/session/audio/${f}`);
    assert.ok(!/fetch\(|http|api\/client|XMLHttpRequest/.test(s), `${f}: no network`);
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(s), f);
  }
  assert.ok(!/from 'react|from 'expo/.test(read('src/features/session/audio/trackStore.ts')), 'store is pure');
});

test('wiring: leftovers cleared at app start; the track deleted when the session screen closes', () => {
  const layout = read('app/_layout.tsx');
  const start = layout.slice(layout.indexOf('useEffect(() => {'), layout.indexOf('}, []);') + 7);
  assert.ok(start.includes('clearBreathTracks();'), 'in the app-start effect');
  assert.ok(start.includes('void removeLegacyIdentity();'), 'the same effect as the other start-up cleanup');
  const player = read('app/session-player.tsx');
  assert.ok(player.includes('const trackNameRef = useRef<string | null>(null);'));
  const close = player.slice(player.indexOf('const trackNameRef'), player.indexOf('const trackNameRef') + 400);
  assert.ok(/useEffect\(\s*\(\) => \(\) => \{\s*deleteBreathTrack\(trackNameRef\.current\);\s*trackNameRef\.current = null;\s*\},\s*\[\]\s*\);/.test(close), 'unmount cleanup');
  // No track is baked or played yet (that is step 5).
  assert.ok(!player.includes('writeBreathTrack'));
  assert.ok(!/from 'expo-audio'/.test(player));
});
