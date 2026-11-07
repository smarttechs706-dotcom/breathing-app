import { AUTH_MESSAGES, authErrorMessage } from './authErrors';
import type { getAuth } from './supabase';
import { isValidNewPassword } from './validation';

export type PasswordChangeFields = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordChangeErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export function validatePasswordChange(fields: PasswordChangeFields): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};
  if (!fields.currentPassword) errors.currentPassword = AUTH_MESSAGES.enterPassword;
  if (!isValidNewPassword(fields.newPassword)) errors.newPassword = AUTH_MESSAGES.weakPassword;
  else if (fields.confirmPassword !== fields.newPassword) {
    errors.confirmPassword = AUTH_MESSAGES.passwordsDontMatch;
  }
  return errors;
}

type PasswordAuth = Pick<ReturnType<typeof getAuth>, 'signInWithPassword' | 'updateUser'>;

// Null means the password changed; anything else is text to show. The sign-in
// comes first because sessions from email links skip Supabase's current password
// check, even for a wrong value (seen on a device). A password session enforces
// it, so current_password is still sent. One attempt each: nothing here retries.
export async function changePassword(
  auth: PasswordAuth,
  email: string,
  fields: Pick<PasswordChangeFields, 'currentPassword' | 'newPassword'>
): Promise<string | null> {
  const { currentPassword, newPassword } = fields;

  try {
    const { error: signInError } = await auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) {
      return signInError.code === 'invalid_credentials'
        ? AUTH_MESSAGES.currentPasswordIncorrect
        : authErrorMessage(signInError);
    }

    const { error } = await auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    return error ? authErrorMessage(error) : null;
  } catch (error) {
    return authErrorMessage(error);
  }
}
