// Turns any auth failure into text that is safe to show. Raw server messages
// never reach the screen, because they can echo input or reveal whether an
// email is registered.

export const AUTH_MESSAGES = {
  invalidCredentials: 'Incorrect email or password',
  emailNotConfirmed: 'Please confirm your email',
  weakPassword: 'Use at least 8 characters',
  samePassword: 'Choose a different password',
  currentPasswordIncorrect: 'Current password is incorrect',
  linkExpired: 'This link was already used or has expired',
  linkInvalid: "This link can't be used",
  logInAgain: 'Please log in again to continue',
  rateLimited: 'Too many attempts. Try again in a few minutes.',
  offline: "Can't reach the server. Check your connection and try again.",
  generic: 'Something went wrong. Please try again.',
  enterFirstName: 'Enter your first name',
  enterEmail: 'Enter a valid email address',
  enterPassword: 'Enter your password',
  // Neutral on purpose: none of these may reveal whether an email is registered.
  checkEmail: 'Check your email to confirm your account',
  resendSent: "If that address needs confirming, we've sent a new link",
  forgotSent: "If an account exists, we've sent a link",
} as const;

// With email confirmation on, Supabase answers an existing address like a new
// one. These codes appear if that protection is ever off. Sign up must still
// end on the same screen, so they are not treated as failures.
export function isAccountExistsError(error: unknown): boolean {
  const { code } = (error ?? {}) as AuthFailure;
  return code === 'user_already_exists' || code === 'email_exists';
}

type AuthFailure = { name?: unknown; status?: unknown; code?: unknown };

// Duck typed so this file stays free of supabase-js imports (see
// scripts/check-auth-rules.mjs) and can be tested on its own.
export function authErrorMessage(error: unknown): string {
  const { name, status, code } = (error ?? {}) as AuthFailure;

  switch (code) {
    case 'invalid_credentials':
      return AUTH_MESSAGES.invalidCredentials;
    case 'email_not_confirmed':
      return AUTH_MESSAGES.emailNotConfirmed;
    case 'weak_password':
      return AUTH_MESSAGES.weakPassword;
    case 'same_password':
      return AUTH_MESSAGES.samePassword;
    // Both seen on a device. "required" should not appear, since the form
    // requires the field, but it must still map to something safe.
    case 'current_password_invalid':
    case 'current_password_required':
      return AUTH_MESSAGES.currentPasswordIncorrect;
    // The server gives this one code for a used link and an expired link.
    case 'otp_expired':
      return AUTH_MESSAGES.linkExpired;
    case 'reauthentication_needed':
      return AUTH_MESSAGES.logInAgain;
    case 'email_address_invalid':
    case 'validation_failed':
      return AUTH_MESSAGES.enterEmail;
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return AUTH_MESSAGES.rateLimited;
  }

  if (status === 429) return AUTH_MESSAGES.rateLimited;
  // auth-js reports a fetch that never got a reply as a retryable error with
  // status 0, which also covers the 15 s timeout.
  if (name === 'AuthRetryableFetchError' && status === 0) return AUTH_MESSAGES.offline;
  if (name === 'AbortError' || name === 'TypeError') return AUTH_MESSAGES.offline;

  return AUTH_MESSAGES.generic;
}
