const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const authErrors = loadTs('src/auth/authErrors.ts');
const { changePassword, validatePasswordChange } = loadTs('src/auth/changePassword.ts', {
  stubs: {
    './authErrors': authErrors,
    './validation': loadTs('src/auth/validation.ts'),
  },
});
const { AUTH_MESSAGES } = authErrors;

const EMAIL = 'someone@example.test';
const FIELDS = { currentPassword: 'old-password', newPassword: 'new-password' };

function fakeAuth({ signIn = { error: null }, update = { error: null } } = {}) {
  const calls = [];
  const respond = (name, reply, args) => {
    calls.push({ name, args });
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return {
    calls,
    signInWithPassword: async (args) => respond('signIn', signIn, args),
    updateUser: async (args) => respond('update', update, args),
  };
}

test('a correct current password signs in first, then updates', async () => {
  const auth = fakeAuth();
  assert.equal(await changePassword(auth, EMAIL, FIELDS), null);

  assert.deepEqual(auth.calls, [
    { name: 'signIn', args: { email: EMAIL, password: FIELDS.currentPassword } },
    {
      name: 'update',
      args: { password: FIELDS.newPassword, current_password: FIELDS.currentPassword },
    },
  ]);
});

test('a wrong current password stops before anything changes', async () => {
  const auth = fakeAuth({ signIn: { error: { code: 'invalid_credentials', status: 400 } } });
  assert.equal(
    await changePassword(auth, EMAIL, FIELDS),
    'Current password is incorrect'
  );
  assert.deepEqual(
    auth.calls.map((call) => call.name),
    ['signIn']
  );
});

test('the server rejecting the current password shows the same message', async () => {
  const auth = fakeAuth({ update: { error: { code: 'current_password_invalid', status: 400 } } });
  assert.equal(
    await changePassword(auth, EMAIL, FIELDS),
    'Current password is incorrect'
  );
});

test('a new password equal to the old one is reported', async () => {
  const auth = fakeAuth({ update: { error: { code: 'same_password', status: 422 } } });
  assert.equal(await changePassword(auth, EMAIL, FIELDS), AUTH_MESSAGES.samePassword);
});

test('a rate limit is reported, so the screen can start its wait', async () => {
  const auth = fakeAuth({ signIn: { error: { status: 429 } } });
  assert.equal(await changePassword(auth, EMAIL, FIELDS), AUTH_MESSAGES.rateLimited);
});

test('no network is reported and nothing retries', async () => {
  const offline = { error: { name: 'AuthRetryableFetchError', status: 0 } };
  const auth = fakeAuth({ update: offline });
  assert.equal(await changePassword(auth, EMAIL, FIELDS), AUTH_MESSAGES.offline);
  assert.equal(auth.calls.length, 2);
});

test('a thrown failure becomes safe text', async () => {
  const auth = fakeAuth({ signIn: new TypeError('Network request failed') });
  assert.equal(await changePassword(auth, EMAIL, FIELDS), AUTH_MESSAGES.offline);
});

test('a failure never shows the password or a server message', async () => {
  const auth = fakeAuth({
    update: { error: { code: 'unknown', status: 500, message: FIELDS.newPassword } },
  });
  assert.equal(await changePassword(auth, EMAIL, FIELDS), AUTH_MESSAGES.generic);
});

const form = (overrides) => ({
  currentPassword: 'old-password',
  newPassword: 'new-password',
  confirmPassword: 'new-password',
  ...overrides,
});

test('a complete form has no errors', () => {
  assert.deepEqual(validatePasswordChange(form()), {});
});

test('the current password is required', () => {
  assert.equal(
    validatePasswordChange(form({ currentPassword: '' })).currentPassword,
    AUTH_MESSAGES.enterPassword
  );
});

test('the new password needs at least 8 characters', () => {
  const errors = validatePasswordChange(form({ newPassword: 'short12', confirmPassword: 'short12' }));
  assert.equal(errors.newPassword, AUTH_MESSAGES.weakPassword);
});

test('the confirm field must match', () => {
  assert.equal(
    validatePasswordChange(form({ confirmPassword: 'new-passwrod' })).confirmPassword,
    "Passwords don't match"
  );
});

test('the confirm error waits until the new password itself is valid', () => {
  const errors = validatePasswordChange(form({ newPassword: 'short', confirmPassword: 'other' }));
  assert.equal(errors.confirmPassword, undefined);
});
