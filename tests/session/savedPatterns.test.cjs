// Tests for "Your patterns" (src/features/session/savedPatterns.ts): one list
// per account on this phone, newest first, at most 8, never the same recipe
// twice, saved when the breathing ends, cleared on Delete account.
// Run with:
//   node --test tests/session/savedPatterns.test.cjs

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const bp = loadTs('src/features/session/breathPattern.ts');
const cp = loadTs('src/features/session/customPattern.ts', { stubs: { './breathPattern': bp } });
const sp = loadTs('src/features/session/savedPatterns.ts', { stubs: { './customPattern': cp } });

const P = (inhale, hold, exhale, rest) => ({ inhale, hold, exhale, rest });
const R = (p, lengthSec) => ({ pattern: p, lengthSec });
const USER = 'user-1234-abcd';
const OTHER = 'user-9999-zzzz';

function memoryStorage({ failGet = false, failSet = false } = {}) {
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
      data.delete(k);
    },
  };
}

test('key: one per account; a missing or odd id reads and writes nothing', () => {
  assert.equal(sp.savedPatternsKey(USER), 'breathe_custom_patterns_v1:user-1234-abcd');
  assert.equal(sp.savedPatternsKey('USER-1234-ABCD'), 'breathe_custom_patterns_v1:user-1234-abcd');
  assert.notEqual(sp.savedPatternsKey(USER), sp.savedPatternsKey(OTHER));
  for (const bad of [null, undefined, '', 'short', 42]) assert.equal(sp.savedPatternsKey(bad), null, String(bad));
});

test('same recipe: the four numbers and the length', () => {
  assert.equal(sp.sameRecipe(R(P(4, 7, 8, 0), 300), R(P(4, 7, 8, 0), 300)), true);
  assert.equal(sp.sameRecipe(R(P(4, 7, 8, 0), 300), R(P(4, 7, 8, 0), 600)), false, 'other length');
  assert.equal(sp.sameRecipe(R(P(4, 7, 8, 0), 300), R(P(4, 7, 8, 1), 300)), false, 'other rest');
});

test('add: newest first, no duplicates (a repeat moves to the front), at most 8', () => {
  let list = [];
  list = sp.addSaved(list, R(P(4, 7, 8, 0), 300));
  list = sp.addSaved(list, R(P(4, 4, 4, 4), 120));
  list = sp.addSaved(list, R(P(4, 7, 8, 0), 300));
  assert.deepEqual(list, [R(P(4, 7, 8, 0), 300), R(P(4, 4, 4, 4), 120)]);
  for (let i = 2; i <= 10; i++) list = sp.addSaved(list, R(P(i, 0, 6, 0), 300));
  assert.equal(sp.MAX_SAVED_PATTERNS, 8);
  assert.equal(list.length, 8);
  assert.deepEqual(list[0], R(P(10, 0, 6, 0), 300), 'newest first');
  // Extra fields are not kept.
  assert.deepEqual(sp.addSaved([], { pattern: { ...P(4, 0, 6, 0), x: 1 }, lengthSec: 300, y: 2 }), [R(P(4, 0, 6, 0), 300)]);
});

test('remove: only that recipe', () => {
  const list = [R(P(4, 7, 8, 0), 300), R(P(4, 7, 8, 0), 600)];
  assert.deepEqual(sp.removeSaved(list, R(P(4, 7, 8, 0), 300)), [R(P(4, 7, 8, 0), 600)]);
});

test('read back: broken, out-of-limit and duplicate entries are dropped', () => {
  assert.deepEqual(sp.parseSaved(null), []);
  assert.deepEqual(sp.parseSaved('not json'), []);
  assert.deepEqual(sp.parseSaved('{"a":1}'), []);
  const raw = JSON.stringify([
    R(P(4, 7, 8, 0), 300),
    R(P(4, 7, 8, 0), 300), // duplicate
    R(P(1, 0, 6, 0), 300), // in below 2
    R(P(10, 9, 12, 0), 300), // one breath 31 s
    R(P(4, 0, 6, 0), 240), // not a length choice
    { pattern: '4-7-8-0', lengthSec: 300 },
    null,
    R(P(5, 0, 5, 0), 600),
  ]);
  assert.deepEqual(sp.parseSaved(raw), [R(P(4, 7, 8, 0), 300), R(P(5, 0, 5, 0), 600)]);
  const many = JSON.stringify(Array.from({ length: 12 }, (_, i) => R(P(2 + (i % 9), i >= 9 ? 1 : 0, 6, 0), 300)));
  assert.equal(sp.parseSaved(many).length, 8);
});

test('storage: per account, survives a reload, remove and clear', async () => {
  const storage = memoryStorage();
  assert.deepEqual(await sp.loadSaved(storage, USER), []);
  assert.deepEqual(await sp.rememberSaved(storage, USER, R(P(4, 7, 8, 0), 300)), [R(P(4, 7, 8, 0), 300)]);
  await sp.rememberSaved(storage, USER, R(P(4, 4, 4, 4), 120));
  await sp.rememberSaved(storage, USER, R(P(4, 7, 8, 0), 300)); // the same recipe again
  assert.deepEqual(await sp.loadSaved(storage, USER), [R(P(4, 7, 8, 0), 300), R(P(4, 4, 4, 4), 120)]);
  assert.deepEqual(await sp.loadSaved(storage, OTHER), [], 'another account sees nothing');

  assert.deepEqual(await sp.forgetSaved(storage, USER, R(P(4, 4, 4, 4), 120)), [R(P(4, 7, 8, 0), 300)]);
  await sp.rememberSaved(storage, OTHER, R(P(5, 0, 5, 0), 600));
  await sp.clearSaved(storage, USER);
  assert.deepEqual(await sp.loadSaved(storage, USER), []);
  assert.deepEqual(await sp.loadSaved(storage, OTHER), [R(P(5, 0, 5, 0), 600)], 'clear is per account');
});

test('storage: an invalid recipe or no account writes nothing', async () => {
  const storage = memoryStorage();
  assert.equal(await sp.rememberSaved(storage, USER, R(P(11, 0, 6, 0), 300)), null);
  assert.equal(await sp.rememberSaved(storage, null, R(P(4, 0, 6, 0), 300)), null);
  assert.equal(storage.data.size, 0);
});

test('storage failures never throw: the row stays empty or unchanged', async () => {
  assert.deepEqual(await sp.loadSaved(memoryStorage({ failGet: true }), USER), []);
  assert.equal(await sp.rememberSaved(memoryStorage({ failSet: true }), USER, R(P(4, 0, 6, 0), 300)), null);
  const failing = memoryStorage({ failSet: true });
  failing.removeItem = async () => {
    throw new Error('remove failed');
  };
  await sp.clearSaved(failing, USER);
});
