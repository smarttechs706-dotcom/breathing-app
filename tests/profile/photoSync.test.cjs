// Tests for keeping the Profile picture on this phone and the account's copy
// in step (src/features/profile/photoSync.ts), with fake files, a fake API and
// a fake clock. Each failure case from the approved plan has a test here.
// Run with:
//   node --test tests/profile/photoSync.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
const pp = loadTs('src/features/profile/profilePhoto.ts');
const sync = loadTs('src/features/profile/photoSync.ts', {
  stubs: { './profilePhoto': pp },
});

const A = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
const DAY = pp.PHOTO_CHECK_INTERVAL_MS;
const JPEG = (n) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, n]);

// One phone and one account: the phone copy, the saved sync state, the
// account's copy on the server, and switches to make each step fail.
function world({ local = null, state = null, server = null, now = 10 * DAY } = {}) {
  const w = {
    local,
    state,
    server,
    now,
    offline: false,
    uploadHangs: false,
    events: [],
  };
  const fail = (what) => {
    w.events.push(`${what} failed`);
    throw new Error('offline');
  };
  w.deps = {
    hasLocal: () => w.local !== null,
    localBytes: async () => w.local,
    saveDownloaded: (userId, bytes) => {
      w.local = bytes;
      w.events.push('saved download');
      return true;
    },
    removeLocal: () => {
      w.local = null;
      w.events.push('removed local');
    },
    readState: async () => w.state,
    writeState: async (userId, s) => {
      w.state = JSON.stringify(s);
    },
    clearState: async () => {
      w.state = null;
      w.events.push('cleared state');
    },
    upload: async (bytes) => {
      if (w.uploadHangs) return new Promise(() => {});
      if (w.offline) fail('upload');
      w.server = bytes;
      w.events.push('uploaded');
    },
    download: async () => {
      if (w.offline) fail('download');
      w.events.push('downloaded');
      return w.server;
    },
    remove: async () => {
      if (w.offline) fail('remove');
      w.server = null;
      w.events.push('removed online');
    },
    now: () => w.now,
  };
  w.saved = () => JSON.parse(w.state);
  return w;
}

// --- Pure rules -------------------------------------------------------------

test('no saved state: a phone copy made before the cloud update is uploaded; no phone copy means download', () => {
  assert.deepEqual(pp.parsePhotoSyncState(null, true), { pendingUpload: true, checkedAt: 0 });
  assert.deepEqual(pp.parsePhotoSyncState(null, false), { pendingUpload: false, checkedAt: 0 });
  for (const bad of ['not json', '{}', '{"pendingUpload":"yes","checkedAt":1}', '{"pendingUpload":true,"checkedAt":-5}', 'null']) {
    assert.deepEqual(pp.parsePhotoSyncState(bad, true), { pendingUpload: true, checkedAt: 0 }, bad);
  }
  assert.deepEqual(pp.parsePhotoSyncState('{"pendingUpload":false,"checkedAt":123}', true), {
    pendingUpload: false,
    checkedAt: 123,
  });
});

test('next step: a waiting upload first; then check online after sign-in, once a day, or if the clock went back', () => {
  const s = (pendingUpload, checkedAt) => ({ pendingUpload, checkedAt });
  assert.equal(pp.nextPhotoSyncStep(s(true, 5), true, 6), 'upload');
  assert.equal(pp.nextPhotoSyncStep(s(true, 5), false, 6), 'download', 'nothing left to upload');
  assert.equal(pp.nextPhotoSyncStep(s(false, 0), false, 6), 'download', 'first check since sign-in');
  assert.equal(pp.nextPhotoSyncStep(s(false, 100), true, 100 + DAY - 1), 'none');
  assert.equal(pp.nextPhotoSyncStep(s(false, 100), true, 100 + DAY), 'download', 'once a day');
  assert.equal(pp.nextPhotoSyncStep(s(false, 100), true, 50), 'download', 'clock went backwards');
  assert.equal(DAY, 24 * 60 * 60 * 1000);
});

test('sync state key is per account and never built from an unusable id', () => {
  assert.equal(pp.photoSyncKey(A), `breathe_photo_sync_v1:${A}`);
  assert.equal(pp.photoSyncKey(null), null);
  assert.equal(pp.photoSyncKey('bad'), null);
});

test('downloaded bytes are kept only if they are a JPEG, replacing older copies', () => {
  const files = new Map([[`${A}-1.jpg`, 'old']]);
  const f = {
    list: () => [...files].map(([name, uri]) => ({ name, uri })),
    remove: (n) => files.delete(n),
    copyIn: async () => '',
    writeIn: (bytes, name) => {
      files.set(name, `file:///${name}`);
      return `file:///${name}`;
    },
  };
  assert.equal(pp.saveDownloadedPhoto(f, A, new Uint8Array([1, 2, 3, 4]), 5), null);
  assert.deepEqual([...files.keys()], [`${A}-1.jpg`]);
  assert.equal(pp.saveDownloadedPhoto(f, A, JPEG(1), 5), `file:///${A}-5.jpg`);
  assert.deepEqual([...files.keys()], [`${A}-5.jpg`]);
  assert.equal(pp.saveDownloadedPhoto(f, 'bad', JPEG(1), 6), null);
});

// --- Choosing a photo ---------------------------------------------------------

test('a new photo is uploaded at once', async () => {
  const w = world({ local: JPEG(1), state: JSON.stringify({ pendingUpload: false, checkedAt: 5 }) });
  assert.equal(await sync.photoChosen(w.deps, A), 'uploaded');
  assert.deepEqual(w.server, JPEG(1));
  assert.deepEqual(w.saved(), { pendingUpload: false, checkedAt: w.now });
});

test('offline: the new photo stays on the phone, waits, and uploads quietly later', async () => {
  const w = world({ local: JPEG(1), state: JSON.stringify({ pendingUpload: false, checkedAt: 5 }) });
  w.offline = true;
  assert.equal(await sync.photoChosen(w.deps, A), 'failed');
  assert.deepEqual(w.local, JPEG(1), 'phone copy kept');
  assert.equal(w.server, null);
  assert.equal(w.saved().pendingUpload, true);
  // Back online, Profile opens: the upload goes through, nothing is downloaded.
  w.offline = false;
  assert.equal(await sync.syncPhoto(w.deps, A), 'uploaded');
  assert.deepEqual(w.server, JPEG(1));
  assert.ok(!w.events.includes('downloaded'));
});

test('an upload that fails halfway keeps the phone copy and the old online copy, and is retried', async () => {
  const w = world({ local: JPEG(2), server: JPEG(1), state: JSON.stringify({ pendingUpload: true, checkedAt: 5 }) });
  w.offline = true;
  assert.equal(await sync.syncPhoto(w.deps, A), 'failed');
  assert.deepEqual(w.local, JPEG(2));
  assert.deepEqual(w.server, JPEG(1), 'online copy unchanged');
  assert.equal(w.saved().pendingUpload, true);
  w.offline = false;
  assert.equal(await sync.syncPhoto(w.deps, A), 'uploaded');
  assert.deepEqual(w.server, JPEG(2));
});

test('a waiting upload is never replaced by a download', async () => {
  const w = world({ local: JPEG(2), server: JPEG(1), state: JSON.stringify({ pendingUpload: true, checkedAt: 0 }) });
  assert.equal(await sync.syncPhoto(w.deps, A), 'uploaded');
  assert.deepEqual(w.local, JPEG(2));
  assert.deepEqual(w.server, JPEG(2));
});

test('a photo chosen before this update is uploaded the first time Profile opens', async () => {
  const w = world({ local: JPEG(1), state: null });
  assert.equal(await sync.syncPhoto(w.deps, A), 'uploaded');
  assert.deepEqual(w.server, JPEG(1));
});

// --- Signing in, second phone, replaced photo -----------------------------------

test('sign-in on a second phone: Profile downloads the account\'s copy', async () => {
  const w = world({ server: JPEG(7) });
  assert.equal(await sync.syncPhoto(w.deps, A), 'downloaded');
  assert.deepEqual(w.local, JPEG(7));
  assert.deepEqual(w.saved(), { pendingUpload: false, checkedAt: w.now });
});

test('no photo online after sign-in: nothing happens, the initial stays', async () => {
  const w = world();
  assert.equal(await sync.syncPhoto(w.deps, A), 'unchanged');
  assert.equal(w.local, null);
  assert.equal(w.saved().checkedAt, w.now);
});

test('a photo replaced on another phone arrives within a day, not before', async () => {
  const w = world({ local: JPEG(1), server: JPEG(2), state: JSON.stringify({ pendingUpload: false, checkedAt: 10 * DAY }) });
  w.now = 10 * DAY + DAY - 1;
  assert.equal(await sync.syncPhoto(w.deps, A), 'unchanged');
  assert.deepEqual(w.local, JPEG(1));
  w.now = 11 * DAY;
  assert.equal(await sync.syncPhoto(w.deps, A), 'downloaded');
  assert.deepEqual(w.local, JPEG(2));
});

test('a photo removed on another phone goes from this phone at the daily check', async () => {
  const w = world({ local: JPEG(1), server: null, state: JSON.stringify({ pendingUpload: false, checkedAt: 1 }) });
  assert.equal(await sync.syncPhoto(w.deps, A), 'removed-locally');
  assert.equal(w.local, null);
});

test('offline during a download: the phone copy and the state stay as they were', async () => {
  const before = JSON.stringify({ pendingUpload: false, checkedAt: 1 });
  const w = world({ local: JPEG(1), state: before });
  w.offline = true;
  assert.equal(await sync.syncPhoto(w.deps, A), 'failed');
  assert.deepEqual(w.local, JPEG(1));
  assert.equal(w.state, before);
});

// --- Remove photo -----------------------------------------------------------------

test('Remove photo: the online copy first, then the phone copy', async () => {
  const w = world({ local: JPEG(1), server: JPEG(1), state: JSON.stringify({ pendingUpload: false, checkedAt: 5 }) });
  assert.equal(await sync.removeEverywhere(w.deps, A), 'removed');
  assert.deepEqual(w.events, ['removed online', 'removed local']);
  assert.equal(w.server, null);
  assert.equal(w.local, null);
});

test('Remove photo offline: nothing is removed anywhere, so the picture cannot come back later', async () => {
  const w = world({ local: JPEG(1), server: JPEG(1), state: JSON.stringify({ pendingUpload: false, checkedAt: 5 }) });
  w.offline = true;
  assert.equal(await sync.removeEverywhere(w.deps, A), 'failed');
  assert.deepEqual(w.local, JPEG(1));
  assert.deepEqual(w.server, JPEG(1));
});

test('Remove photo waits for a running upload, so the upload cannot put the picture back', async () => {
  const w = world({ local: JPEG(1), state: JSON.stringify({ pendingUpload: true, checkedAt: 5 }) });
  let release;
  const gate = new Promise((r) => (release = r));
  const realUpload = w.deps.upload;
  w.deps.upload = async (bytes) => {
    await gate;
    return realUpload(bytes);
  };
  const uploading = sync.syncPhoto(w.deps, A);
  const removing = sync.removeEverywhere(w.deps, A);
  release();
  assert.equal(await uploading, 'uploaded');
  assert.equal(await removing, 'removed');
  assert.deepEqual(w.events, ['uploaded', 'removed online', 'removed local']);
  assert.equal(w.server, null, 'nothing left online');
});

// --- Sign out ------------------------------------------------------------------------

test('sign out with nothing waiting: no upload, no wait', async () => {
  const w = world({ local: JPEG(1), state: JSON.stringify({ pendingUpload: false, checkedAt: 5 }) });
  assert.equal(await sync.flushBeforeSignOut(w.deps, A, 5000), 'ok');
  assert.deepEqual(w.events, []);
});

test('sign out with a waiting photo: it is uploaded first', async () => {
  const w = world({ local: JPEG(1), state: JSON.stringify({ pendingUpload: true, checkedAt: 5 }) });
  assert.equal(await sync.flushBeforeSignOut(w.deps, A, 5000), 'ok');
  assert.deepEqual(w.server, JPEG(1));
});

test('sign out while offline: reports the photo as unsaved so the user is asked', async () => {
  const w = world({ local: JPEG(1), state: JSON.stringify({ pendingUpload: true, checkedAt: 5 }) });
  w.offline = true;
  assert.equal(await sync.flushBeforeSignOut(w.deps, A, 5000), 'unsaved');
});

test('sign out never hangs: an upload that never answers gives up after the wait', async () => {
  // Its own account: the fake upload never ends, so it stays the running sync
  // for that account (in the app every upload ends within its 20 s timeout).
  const HUNG = '00000000-0000-4000-8000-0000000000aa';
  const w = world({ local: JPEG(1), state: JSON.stringify({ pendingUpload: true, checkedAt: 5 }) });
  w.uploadHangs = true;
  const started = Date.now();
  assert.equal(await sync.flushBeforeSignOut(w.deps, HUNG, 50), 'unsaved');
  assert.ok(Date.now() - started < 1000);
});

test('forgetting on the phone removes the file and the sync state, never the online copy', async () => {
  const w = world({ local: JPEG(1), server: JPEG(1), state: JSON.stringify({ pendingUpload: false, checkedAt: 5 }) });
  await sync.forgetOnPhone(w.deps, A);
  assert.equal(w.local, null);
  assert.equal(w.state, null);
  assert.deepEqual(w.server, JPEG(1));
  assert.ok(!w.events.includes('removed online'));
  // Next sign-in on this phone: the picture comes back from the account.
  assert.equal(await sync.syncPhoto(w.deps, A), 'downloaded');
  assert.deepEqual(w.local, JPEG(1));
});

// --- Wiring -------------------------------------------------------------------------

test('the API module: our API only, the photo route, JPEG body, no id sent', () => {
  const src = read('src/api/profilePhoto.ts');
  assert.ok(src.includes("new URL('/api/profile-photo', getApiBaseUrl())"));
  assert.ok(src.includes("{ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: bytes as unknown as BodyInit }"));
  assert.ok(src.includes("{ method: 'DELETE' }"));
  assert.ok(!/supabase|storage|user_id|userId/i.test(src.replace(/\/\/.*$/gm, '')), 'no Supabase, no id sent');
});

// --- "No photo online" only on the API's exact 200 JSON reply ------------------------

test('media type ignores parameters and case; the no-photo body is exactly {"photo":null}', () => {
  assert.equal(pp.mediaType('application/json; charset=utf-8'), 'application/json');
  assert.equal(pp.mediaType('Image/JPEG'), 'image/jpeg');
  assert.equal(pp.mediaType(null), '');
  assert.equal(pp.isNoPhotoBody('{"photo":null}'), true);
  assert.equal(pp.isNoPhotoBody(' { "photo" : null } '), true);
  for (const bad of ['{"photo":null,"extra":1}', '{"photo":false}', '{"photo":"null"}', '{}', 'null', '[null]', '', '<html>']) {
    assert.equal(pp.isNoPhotoBody(bad), false, bad);
  }
});

// getProfilePhoto with a fake authedFetch: a reply that reaches the callback
// (a 2xx), or a rejection like authedFetch's for 404, 500 or no network.
function photoApi(reply) {
  return loadTs('src/api/profilePhoto.ts', {
    stubs: {
      '../features/profile/profilePhoto': pp,
      './client': {
        getApiBaseUrl: () => 'https://api.test',
        authedFetch: async (label, url, init, handle) => {
          if (reply.reject !== undefined) throw Object.assign(new Error('fake'), { status: reply.reject });
          return handle({
            status: reply.status ?? 200,
            headers: { get: (h) => (h.toLowerCase() === 'content-type' ? reply.type ?? null : null) },
            text: async () => reply.body ?? '',
            arrayBuffer: async () => (reply.bytes ?? new Uint8Array(0)).buffer,
          });
        },
      },
    },
  });
}

test('getProfilePhoto: image/jpeg gives the bytes; the exact JSON reply gives null', async () => {
  assert.deepEqual(await photoApi({ type: 'image/jpeg', bytes: JPEG(9) }).getProfilePhoto(), JPEG(9));
  assert.equal(await photoApi({ type: 'application/json', body: '{"photo":null}' }).getProfilePhoto(), null);
  assert.equal(
    await photoApi({ type: 'application/json; charset=utf-8', body: '{"photo":null}' }).getProfilePhoto(),
    null,
    'the charset Next.js adds'
  );
});

test('getProfilePhoto: every other reply throws ("unknown"), never "no photo"', async () => {
  for (const [why, reply] of [
    ['404 from a route that is not deployed', { reject: 404 }],
    ['other 404', { reject: 404 }],
    ['server error', { reject: 500 }],
    ['network error', { reject: 0 }],
    ['HTML 200 page (captive portal, wrong host)', { type: 'text/html; charset=utf-8', body: '<!DOCTYPE html><html><body>Sign in to Wi-Fi</body></html>' }],
    ['JSON 200 with extra keys', { type: 'application/json', body: '{"photo":null,"note":"x"}' }],
    ['JSON 200 with another body', { type: 'application/json', body: '{"error":"No photo."}' }],
    ['JSON 200 photo false', { type: 'application/json', body: '{"photo":false}' }],
    ['the no-photo body as text/plain', { type: 'text/plain', body: '{"photo":null}' }],
    ['no content type', { body: '{"photo":null}' }],
    ['the no-photo body with status 204', { status: 204, type: 'application/json', body: '{"photo":null}' }],
  ]) {
    await assert.rejects(photoApi(reply).getProfilePhoto(), undefined, why);
  }
});

for (const [what, failure] of [
  ['a 404 without the no-photo body', 'GET /api/profile-photo failed: 404'],
  ['a 404 from a route that is not deployed', 'GET /api/profile-photo failed: 404 (route missing)'],
  ['a network error', 'GET /api/profile-photo got no reply'],
]) {
  test(`${what} keeps the phone copy at the daily check (not "removed on another phone")`, async () => {
    const before = JSON.stringify({ pendingUpload: false, checkedAt: 1 });
    const w = world({ local: JPEG(1), state: before });
    w.deps.download = async () => {
      throw new Error(failure);
    };
    assert.equal(await sync.syncPhoto(w.deps, A), 'failed');
    assert.deepEqual(w.local, JPEG(1), 'phone copy kept');
    assert.ok(!w.events.includes('removed local'));
    assert.equal(w.state, before, 'state untouched, so the next Profile open tries again');
  });

  test(`${what} after sign-in leaves nothing marked as checked, so the next Profile open tries again`, async () => {
    const w = world();
    w.deps.download = async () => {
      throw new Error(failure);
    };
    assert.equal(await sync.syncPhoto(w.deps, A), 'failed');
    assert.equal(w.state, null);
    w.deps.download = async () => JPEG(3);
    assert.equal(await sync.syncPhoto(w.deps, A), 'downloaded');
    assert.deepEqual(w.local, JPEG(3));
  });
}

test('client.ts: the only change is exporting authedFetch', () => {
  const src = read('src/api/client.ts');
  assert.ok(src.includes('export async function authedFetch<T>('));
  assert.equal((src.match(/function authedFetch/g) || []).length, 1);
});

test('the store wires the sync to the API module and saves state under the per-account key', () => {
  const store = read('src/features/profile/profilePhotoStore.ts');
  for (const s of [
    "import { deleteProfilePhoto, getProfilePhoto, putProfilePhoto } from '../../api/profilePhoto';",
    'upload: (bytes) => putProfilePhoto(bytes),',
    'download: () => getProfilePhoto(),',
    'remove: () => deleteProfilePhoto(),',
    'const key = photoSyncKey(userId);',
    'void photoChosen(syncDeps, userId);',
    'return await flushBeforeSignOut(syncDeps, userId, SIGN_OUT_UPLOAD_WAIT_MS);',
  ]) {
    assert.ok(store.includes(s), s);
  }
});

test('no long dashes or emoji in the new files', () => {
  for (const f of ['src/features/profile/photoSync.ts', 'src/api/profilePhoto.ts', 'src/features/profile/profilePhotoStore.ts', 'app/settings.tsx']) {
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(read(f)), f);
  }
});
