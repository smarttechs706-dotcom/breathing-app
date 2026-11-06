const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const { AUTH_MESSAGES, authErrorMessage, isAccountExistsError } = loadTs('src/auth/authErrors.ts');

test('account-exists codes are recognised so sign up can end the same way', () => {
  assert.equal(isAccountExistsError({ code: 'user_already_exists' }), true);
  assert.equal(isAccountExistsError({ code: 'email_exists' }), true);
  assert.equal(isAccountExistsError({ code: 'weak_password' }), false);
  assert.equal(isAccountExistsError(null), false);
});

test('neutral messages never say whether an account exists', () => {
  for (const key of ['checkEmail', 'resendSent', 'forgotSent', 'invalidCredentials']) {
    assert.doesNotMatch(AUTH_MESSAGES[key], /already|registered|not found|no account/i);
  }
});

const cases = [
  [{ code: 'invalid_credentials', status: 400 }, 'invalidCredentials'],
  [{ code: 'email_not_confirmed', status: 400 }, 'emailNotConfirmed'],
  [{ code: 'weak_password', status: 422 }, 'weakPassword'],
  [{ code: 'same_password', status: 422 }, 'samePassword'],
  [{ code: 'current_password_invalid', status: 400 }, 'currentPasswordIncorrect'],
  [{ code: 'current_password_required', status: 400 }, 'currentPasswordIncorrect'],
  [{ code: 'otp_expired', status: 403 }, 'linkExpired'],
  [{ code: 'reauthentication_needed', status: 400 }, 'logInAgain'],
  [{ code: 'over_email_send_rate_limit', status: 429 }, 'rateLimited'],
  [{ code: 'over_request_rate_limit', status: 429 }, 'rateLimited'],
  [{ status: 429 }, 'rateLimited'],
  [{ name: 'AuthRetryableFetchError', status: 0 }, 'offline'],
  [{ name: 'AbortError' }, 'offline'],
  [{ name: 'AuthRetryableFetchError', status: 500 }, 'generic'],
];

for (const [error, expected] of cases) {
  test(`${JSON.stringify(error)} shows ${expected}`, () => {
    assert.equal(authErrorMessage(error), AUTH_MESSAGES[expected]);
  });
}

for (const value of [null, undefined, 'text', {}]) {
  test(`${JSON.stringify(value)} falls back to the generic message`, () => {
    assert.equal(authErrorMessage(value), AUTH_MESSAGES.generic);
  });
}

test('never shows the raw server message', () => {
  const message = 'A user with user@example.com already exists';
  assert.equal(authErrorMessage({ message, status: 400 }), AUTH_MESSAGES.generic);
});
