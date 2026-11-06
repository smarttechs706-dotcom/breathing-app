const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const { parseAuthLink, safeSystemPath } = loadTs('src/auth/deepLink.ts');
const validHash = 'a1'.repeat(28);
const validPath = `/auth/callback?token_hash=${validHash}&type=email`;

test('a valid link is passed on in one fixed form, whatever its shape', () => {
  const forms = [
    `breathingapp://auth/callback?token_hash=${validHash}&type=email`,
    `breathingapp:///auth/callback?type=email&token_hash=${validHash}`,
    `/auth/callback?token_hash=${validHash}&type=email`,
    `auth/callback/?token_hash=${validHash}&type=email&utm=x`,
  ];
  for (const form of forms) assert.equal(safeSystemPath(form), validPath);
});

test('a link cannot smuggle in another type or destination', () => {
  const path = `breathingapp://auth/callback?token_hash=${validHash}&type=recovery&next=/home`;
  assert.equal(
    safeSystemPath(path),
    `/auth/callback?token_hash=${validHash}&type=recovery`
  );
});

const unsafePaths = [
  'breathingapp://auth/callback',
  'breathingapp://auth/callback?type=email',
  `breathingapp://auth/callback?token_hash=bad&type=email`,
  `breathingapp://auth/callback?token_hash=${validHash}&type=signup`,
  'breathingapp://settings',
  'breathingapp://reset-password',
  '/home',
  '',
  '?',
  '%%%',
];

for (const path of unsafePaths) {
  test(`system path ${JSON.stringify(path)} goes to the root route`, () => {
    assert.equal(safeSystemPath(path), '/');
  });
}

test('dev client URLs pass through', () => {
  const path = 'breathingapp://expo-development-client/?url=http%3A%2F%2F10.0.0.2%3A8081';
  assert.equal(safeSystemPath(path), path);
});

test('accepts both link types with a valid hash', () => {
  assert.deepEqual(parseAuthLink(validHash, 'email'), { tokenHash: validHash, type: 'email' });
  assert.deepEqual(parseAuthLink(validHash, 'recovery'), {
    tokenHash: validHash,
    type: 'recovery',
  });
});

test('uses the first value when a param arrives as an array', () => {
  assert.equal(parseAuthLink([validHash, 'x'], ['email', 'recovery']).type, 'email');
});

const rejected = [
  ['an unknown type', validHash, 'magiclink'],
  ['a missing type', validHash, undefined],
  ['a missing hash', undefined, 'email'],
  ['an empty hash', '', 'email'],
  ['a pkce_ prefix', `pkce_${validHash}`, 'email'],
  ['a short hash', validHash.slice(1), 'email'],
  ['a long hash', `${validHash}a`, 'email'],
  ['uppercase hex', validHash.toUpperCase(), 'email'],
  ['extra query text', `${validHash}&type=recovery`, 'email'],
];

for (const [name, hash, type] of rejected) {
  test(`rejects ${name}`, () => {
    assert.equal(parseAuthLink(hash, type), null);
  });
}
