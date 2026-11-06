const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const { deriveAuthStatus, storedSessionIsUsable } = loadTs('src/auth/authStatus.ts');

const signedOut = {
  ready: true,
  hasSession: false,
  pendingLink: null,
  hasUnrestoredSession: false,
};

test('stays loading until startup finishes, even with a session', () => {
  assert.equal(deriveAuthStatus({ ...signedOut, ready: false, hasSession: true }), 'loading');
});

test('no session and nothing stored is signed out', () => {
  assert.equal(deriveAuthStatus(signedOut), 'signedOut');
});

test('a session with no link is signed in', () => {
  assert.equal(deriveAuthStatus({ ...signedOut, hasSession: true }), 'signedIn');
});

test('a recovery link never enters the app as signed in', () => {
  assert.equal(
    deriveAuthStatus({ ...signedOut, hasSession: true, pendingLink: 'recovery' }),
    'recovery'
  );
});

test('an email link shows the confirm screen before Home', () => {
  assert.equal(
    deriveAuthStatus({ ...signedOut, hasSession: true, pendingLink: 'linkConfirm' }),
    'linkConfirm'
  );
});

test('a stored session that could not refresh is offline, not signed out', () => {
  assert.equal(deriveAuthStatus({ ...signedOut, hasUnrestoredSession: true }), 'offlineRestore');
});

test('a link flag without a session grants nothing', () => {
  assert.equal(deriveAuthStatus({ ...signedOut, pendingLink: 'recovery' }), 'signedOut');
});

test('a stored session needs a refresh token to be usable', () => {
  assert.equal(storedSessionIsUsable('{"refresh_token":"x"}'), true);
});

for (const raw of [null, '', 'not json', '{}', '{"refresh_token":""}', '{"refresh_token":1}']) {
  test(`stored value ${JSON.stringify(raw)} is not usable`, () => {
    assert.equal(storedSessionIsUsable(raw), false);
  });
}
