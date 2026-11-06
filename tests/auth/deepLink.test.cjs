const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const { parseAuthLink } = loadTs('src/auth/deepLink.ts');
const validHash = 'a1'.repeat(28);

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
