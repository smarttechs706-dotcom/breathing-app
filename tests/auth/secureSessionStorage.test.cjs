const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

// A fake SecureStore that enforces the key characters the real one allows and
// can fail partway through a write, like an app killed mid-save.
function setup() {
  const store = new Map();
  const state = { writes: 0, failAfter: Infinity, longest: 0, badKey: null };

  const SecureStore = {
    async getItemAsync(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setItemAsync(key, value) {
      if (!/^[A-Za-z0-9._-]+$/.test(key)) state.badKey = key;
      if (state.writes++ >= state.failAfter) throw new Error('killed');
      state.longest = Math.max(state.longest, Buffer.byteLength(value));
      store.set(key, value);
    },
    async deleteItemAsync(key) {
      store.delete(key);
    },
  };

  const adapter = loadTs('src/auth/secureSessionStorage.ts', {
    stubs: {
      'expo-secure-store': SecureStore,
      'react-native': { Platform: { OS: 'android' } },
      '@react-native-async-storage/async-storage': { default: {} },
    },
  });

  return { ...adapter, store, state };
}

const bigValue = JSON.stringify({ a: 'x'.repeat(5000), n: 'نور😀é'.repeat(300) });

test('a large session survives a save and read, in chunks of 1800 bytes or less', async () => {
  const { secureSessionStorage: storage, store, state } = setup();
  await storage.setItem('k', bigValue);

  assert.equal(await storage.getItem('k'), bigValue);
  assert.ok(state.longest <= 1800);
  assert.equal(state.badKey, null);
  assert.ok([...store.keys()].filter((key) => /^k\.\d+\.\d+$/.test(key)).length > 1);
});

test('overwriting replaces the value and removes the old chunks', async () => {
  const { secureSessionStorage: storage, store } = setup();
  const next = JSON.stringify({ b: 'y'.repeat(4000) });
  await storage.setItem('k', bigValue);
  await storage.setItem('k', next);

  assert.equal(await storage.getItem('k'), next);
  assert.ok(![...store.keys()].some((key) => key.startsWith('k.1.')));
});

test('an interrupted write fails and keeps the previous session', async () => {
  const { secureSessionStorage: storage, state } = setup();
  await storage.setItem('k', 'first');
  state.writes = 0;
  state.failAfter = 1;

  await assert.rejects(storage.setItem('k', 'z'.repeat(5000)));
  state.failAfter = Infinity;
  assert.equal(await storage.getItem('k'), 'first');
});

test('concurrent writes run in order, so the last one wins', async () => {
  const { secureSessionStorage: storage } = setup();
  await Promise.all(
    ['1', '2', '3'].map((digit) => storage.setItem('c', digit.repeat(3000)))
  );
  assert.equal(await storage.getItem('c'), '3'.repeat(3000));
});

test('corrupt data reads as no session instead of crashing', async () => {
  const { secureSessionStorage: storage, store } = setup();
  await storage.setItem('k', bigValue);

  store.set('k.m', '{bad json');
  assert.equal(await storage.getItem('k'), null);

  store.set('k.m', JSON.stringify({ g: 9, n: 2 }));
  assert.equal(await storage.getItem('k'), null);
});

test('remove clears the value and every chunk', async () => {
  const { secureSessionStorage: storage, store } = setup();
  await storage.setItem('r', 'q'.repeat(4000));
  await storage.removeItem('r');

  assert.equal(await storage.getItem('r'), null);
  assert.ok(![...store.keys()].some((key) => key.startsWith('r.')));
});

test('an empty string is stored as a value, not as nothing', async () => {
  const { secureSessionStorage: storage } = setup();
  await storage.setItem('e', '');
  assert.equal(await storage.getItem('e'), '');
});

test('splitting never cuts a multi-byte character in half', () => {
  const { splitUtf8 } = setup();
  assert.ok(splitUtf8('😀'.repeat(10), 5).every((chunk) => chunk === '😀'));
});
