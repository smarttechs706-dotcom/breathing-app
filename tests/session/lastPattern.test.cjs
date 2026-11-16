// Tests for the last custom pattern (src/features/session/lastPattern.ts):
// exactly one recipe per account on this phone, the editor's default when there
// is none or it is broken, cleared on Delete account.
// Run with:
//   node --test tests/session/lastPattern.test.cjs

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const bp = loadTs('src/features/session/breathPattern.ts');
const cp = loadTs('src/features/session/customPattern.ts', { stubs: { './breathPattern': bp } });
const lp = loadTs('src/features/session/lastPattern.ts', { stubs: { './customPattern': cp } });

const P = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });
const R = (p, lengthSec) => ({ pattern: p, lengthSec });
const USER = 'user-1234-abcd';
const OTHER = 'user-9999-zzzz';
const DEFAULT = R(P(4, 0, 6, 0), 300);

function memoryStorage({ failGet = false, failSet = false, failRemove = false } = {}) {
  const data = new Map();
  return {
    data,
    async getItem(k) {
      if (failGet) throw new Error('read failed');
      return data.has(k) ? data.get(k) : null;
    },
    async setItem(k, v) {
      if (failSet) throw new Error('write failed');
      data.set(k, v);
    },
    async removeItem(k) {
      if (failRemove) throw new Error('remove failed');
      data.delete(k);
    },
  };
}

test('default: 4-0-6-0 at 5 min', () => {
  assert.deepEqual(lp.DEFAULT_RECIPE, DEFAULT);
});

test('key: one per account; a missing or odd id reads and writes nothing', () => {
  assert.equal(lp.lastPatternKey(USER), 'breathe_custom_last_v1:user-1234-abcd');
  assert.equal(lp.lastPatternKey('USER-1234-ABCD'), 'breathe_custom_last_v1:user-1234-abcd');
  assert.notEqual(lp.lastPatternKey(USER), lp.lastPatternKey(OTHER));
  for (const bad of [null, undefined, '', 'short', 42]) assert.equal(lp.lastPatternKey(bad), null, String(bad));
});

test('store: exactly one recipe; a new one replaces the old', async () => {
  const storage = memoryStorage();
  assert.deepEqual(await lp.loadLast(storage, USER), DEFAULT, 'nothing stored yet: the default');
  assert.equal(await lp.saveLast(storage, USER, R(P(4, 7, 8, 0), 300)), true);
  assert.deepEqual(await lp.loadLast(storage, USER), R(P(4, 7, 8, 0), 300));
  assert.equal(await lp.saveLast(storage, USER, R(P(5, 0, 5, 0), 600)), true);
  assert.deepEqual(await lp.loadLast(storage, USER), R(P(5, 0, 5, 0), 600));
  assert.equal(storage.data.size, 1, 'one value per account, not a list');
  assert.deepEqual(JSON.parse(storage.data.get(lp.lastPatternKey(USER))), R(P(5, 0, 5, 0), 600));
  // Another account has its own.
  assert.deepEqual(await lp.loadLast(storage, OTHER), DEFAULT);
  // Only the four numbers and the length are kept.
  await lp.saveLast(storage, USER, { pattern: { ...P(4, 4, 4, 4), x: 1 }, lengthSec: 120, y: 2 });
  assert.deepEqual(JSON.parse(storage.data.get(lp.lastPatternKey(USER))), R(P(4, 4, 4, 4), 120));
});

test('a broken or out-of-limit stored value falls back to the default', async () => {
  const broken = [
    'not json',
    '[]',
    'null',
    '{"pattern":"4-7-8-0","lengthSec":300}',
    JSON.stringify(R(P(1, 0, 6, 0), 300)), // in below 2
    JSON.stringify(R(P(10, 9, 12, 0), 300)), // one breath 31 s
    JSON.stringify(R(P(4, 0, 6, 0), 240)), // not a length choice
    JSON.stringify({ pattern: P(4, 0, 6, 0) }), // no length
  ];
  for (const raw of broken) {
    const storage = memoryStorage();
    storage.data.set(lp.lastPatternKey(USER), raw);
    assert.deepEqual(await lp.loadLast(storage, USER), DEFAULT, raw);
  }
  assert.equal(lp.parseLast(null), null);
  assert.deepEqual(lp.parseLast(JSON.stringify(R(P(4, 7, 8, 0), 180))), R(P(4, 7, 8, 0), 180));
});

test('an invalid recipe or no account writes nothing', async () => {
  const storage = memoryStorage();
  assert.equal(await lp.saveLast(storage, USER, R(P(11, 0, 6, 0), 300)), false);
  assert.equal(await lp.saveLast(storage, USER, R(P(4, 0, 6, 0), 240)), false);
  assert.equal(await lp.saveLast(storage, null, R(P(4, 0, 6, 0), 300)), false);
  assert.equal(storage.data.size, 0);
  assert.deepEqual(await lp.loadLast(storage, null), DEFAULT);
});

test('Delete account clears it, only for that account', async () => {
  const storage = memoryStorage();
  await lp.saveLast(storage, USER, R(P(4, 7, 8, 0), 300));
  await lp.saveLast(storage, OTHER, R(P(5, 0, 5, 0), 600));
  await lp.clearLast(storage, USER);
  assert.deepEqual(await lp.loadLast(storage, USER), DEFAULT);
  assert.deepEqual(await lp.loadLast(storage, OTHER), R(P(5, 0, 5, 0), 600));
});

test('storage failures never throw', async () => {
  assert.deepEqual(await lp.loadLast(memoryStorage({ failGet: true }), USER), DEFAULT);
  assert.equal(await lp.saveLast(memoryStorage({ failSet: true }), USER, DEFAULT), false);
  await lp.clearLast(memoryStorage({ failRemove: true }), USER);
});
