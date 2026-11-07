const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const fresh = () => loadTs('src/auth/sessionExpiry.ts');

test('the notice shows once, and only after a report', () => {
  const expiry = fresh();
  assert.equal(expiry.consumeSignInNotice(), false);
  expiry.reportSessionExpired();
  assert.equal(expiry.consumeSignInNotice(), true);
  assert.equal(expiry.consumeSignInNotice(), false);
});

test('a failing sign-out never reaches the caller', async () => {
  const rejecting = fresh();
  rejecting.setSessionExpiredHandler(async () => {
    throw new Error('sign-out failed');
  });
  assert.doesNotThrow(() => rejecting.reportSessionExpired());

  const throwing = fresh();
  throwing.setSessionExpiredHandler(() => {
    throw new Error('sign-out failed');
  });
  assert.doesNotThrow(() => throwing.reportSessionExpired());
  await new Promise((resolve) => setImmediate(resolve));
});

test('an unregistered handler is not called', () => {
  const expiry = fresh();
  let calls = 0;
  const unregister = expiry.setSessionExpiredHandler(() => {
    calls += 1;
  });
  unregister();
  expiry.reportSessionExpired();
  assert.equal(calls, 0);
});

test('unregistering an old handler leaves the newer one in place', () => {
  const expiry = fresh();
  let calls = 0;
  const unregisterOld = expiry.setSessionExpiredHandler(() => {});
  expiry.setSessionExpiredHandler(() => {
    calls += 1;
  });
  unregisterOld();
  expiry.reportSessionExpired();
  assert.equal(calls, 1);
});

function legacyCleanup(storage) {
  return loadTs('src/utils/legacyCleanup.ts', {
    stubs: {
      '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    },
  });
}

test('startup cleanup removes the old id and nothing else', async () => {
  const removed = [];
  const { removeLegacyIdentity } = legacyCleanup({
    getAllKeys: async () => [
      'breathe_device_id_v1',
      'breathe_onboarding_complete_v1',
      'breathe_reminder_settings_v1',
      'breathe_user_name_v1',
      'breathease_pending_link',
    ],
    multiRemove: async (keys) => removed.push(...keys),
  });

  await removeLegacyIdentity();
  assert.deepEqual(removed, ['breathe_device_id_v1']);
});

test('startup cleanup does nothing when there is no old id', async () => {
  let calls = 0;
  const { removeLegacyIdentity } = legacyCleanup({
    getAllKeys: async () => ['breathe_user_name_v1'],
    multiRemove: async () => {
      calls += 1;
    },
  });

  await removeLegacyIdentity();
  assert.equal(calls, 0);
});

test('startup cleanup never fails the launch', async () => {
  const { removeLegacyIdentity } = legacyCleanup({
    getAllKeys: async () => {
      throw new Error('storage unavailable');
    },
  });
  await assert.doesNotReject(removeLegacyIdentity());
});
