import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { AUTH_MESSAGES } from '../src/auth/authErrors';
import { useAuth } from '../src/auth/AuthProvider';
import {
  changePassword,
  validatePasswordChange,
  type PasswordChangeErrors,
} from '../src/auth/changePassword';
import { getAuth } from '../src/auth/supabase';
import { useCooldown } from '../src/auth/useCooldown';
import { useSingleFlight } from '../src/auth/useSingleFlight';
import { AuthScreen } from '../src/components/auth/AuthScreen';
import { FormMessage } from '../src/components/auth/FormMessage';
import { GradientButton } from '../src/components/auth/GradientButton';
import { PasswordField } from '../src/components/auth/PasswordField';

export default function ChangePasswordScreen() {
  const { session } = useAuth();
  const { running, run } = useSingleFlight();
  const { secondsLeft, start } = useCooldown('changePassword');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const submit = () =>
    run(async () => {
      setFormError(null);
      setChanged(false);
      const next = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
      setErrors(next);
      if (Object.keys(next).length > 0) return;

      const email = session?.user.email;
      if (!email) {
        setFormError(AUTH_MESSAGES.generic);
        return;
      }

      const failure = await changePassword(getAuth(), email, { currentPassword, newPassword });
      if (failure) {
        setFormError(failure);
        // A typo can be fixed straight away. Only a rate limit makes people wait.
        if (failure === AUTH_MESSAGES.rateLimited) start();
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChanged(true);
    });

  const submitUnlessWaiting = () => {
    if (secondsLeft === 0) void submit();
  };

  return (
    <AuthScreen title="Change password" backTo="/settings">
      <PasswordField
        label="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        error={errors.currentPassword}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => newRef.current?.focus()}
      />
      <PasswordField
        ref={newRef}
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        error={errors.newPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <PasswordField
        ref={confirmRef}
        label="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submitUnlessWaiting}
      />
      {changed ? <FormMessage message={AUTH_MESSAGES.passwordChanged} tone="info" /> : null}
      <FormMessage message={formError} />
      <GradientButton
        label={secondsLeft > 0 ? `Try again in ${secondsLeft}s` : 'Change password'}
        onPress={submit}
        running={running}
        disabled={secondsLeft > 0}
      />
    </AuthScreen>
  );
}
