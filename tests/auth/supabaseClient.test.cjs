const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const VALID_URL = 'https://abcdefghijklmnopqrst.supabase.co';
const VALID_KEY = 'sb_publishable_abc123';

function load(env) {
  const created = [];
  const client = loadTs('src/auth/supabase.ts', {
    env,
    stubs: {
      'react-native-url-polyfill/auto': {},
      '@supabase/supabase-js': {
        createClient(url, key, options) {
          created.push({ url, key, options });
          return { auth: { fake: true } };
        },
      },
      'react-native': {
        AppState: { addEventListener() {} },
        Platform: { OS: 'android' },
      },
      './secureSessionStorage': { secureSessionStorage: {} },
    },
  });
  return { client, created };
}

const env = (url, key) => ({
  ...(url === undefined ? {} : { EXPO_PUBLIC_SUPABASE_URL: url }),
  ...(key === undefined ? {} : { EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
});

const failures = [
  ['a missing URL', undefined, VALID_KEY, /SUPABASE_URL is missing/],
  ['a missing key', VALID_URL, undefined, /PUBLISHABLE_KEY is missing/],
  ['an http URL', 'http://x.supabase.co', VALID_KEY, /not a real https/],
  ['a placeholder URL', 'https://placeholder.invalid', VALID_KEY, /not a real https/],
  ['a placeholder key', VALID_URL, 'your-key-here', /not a publishable key/],
  ['a secret key', VALID_URL, 'sb_secret_abc123', /not a publishable key/],
];

for (const [name, url, key, message] of failures) {
  test(`fails loudly on ${name}`, () => {
    assert.throws(() => load(env(url, key)), message);
  });
}

test('errors name the setting but never echo its value', () => {
  assert.throws(
    () => load(env(VALID_URL, 'sb_secret_abc123')),
    (error) => !error.message.includes('abc123')
  );
});

test('valid values build one client with the proven auth settings', () => {
  const { created } = load(env(VALID_URL, VALID_KEY));

  assert.equal(created.length, 1);
  assert.equal(created[0].options.auth.flowType, 'implicit');
  assert.equal(created[0].options.auth.detectSessionInUrl, false);
  assert.equal(created[0].options.auth.persistSession, true);
});

test('only getAuth and the storage key leave the file, never the client', () => {
  const { client } = load(env(VALID_URL, VALID_KEY));

  assert.deepEqual(Object.keys(client).sort(), ['SESSION_STORAGE_KEY', 'getAuth']);
  assert.deepEqual(client.getAuth(), { fake: true });
});
