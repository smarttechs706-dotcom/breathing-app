import { useState } from 'react';

import { AUTH_MESSAGES, authErrorMessage } from '../src/auth/authErrors';
import { useAuth } from '../src/auth/AuthProvider';
import { getAuth } from '../src/auth/supabase';
import { useSingleFlight } from '../src/auth/useSingleFlight';
import { isValidNewPassword } from '../src/auth/validation';
import { AccountEmail } from '../src/components/auth/AccountEmail';
import { AuthLink } from '../src/components/auth/AuthLink';
import { AuthScreen } from '../src/components/auth/AuthScreen';
import { FormMessage } from '../src/components/auth/FormMessage';
import { GradientButton } from '../src/components/auth/GradientButton';
import { PasswordField } from '../src/components/auth/PasswordField';

// Reachable only in the recovery status. A kill here returns here on the next
// launch, and leaving means signing out, so a reset link never ends in Home
// without a new password. The guard handles navigation in both cases.
export default function ResetPasswordScreen() {
  const { session, endLink, signOut } = useAuth();
  const { running, run } = useSingleFlight();
  const cancelling = useSingleFlight();
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = () =>
    run(async () => {
      setFormError(null);
      if (!isValidNewPassword(password)) {
        setFieldError(AUTH_MESSAGES.weakPassword);
        return;
      }
      setFieldError(null);

      try {
        const { error } = await getAuth().updateUser({ password });
        if (error) {
          setFormError(authErrorMessage(error));
          return;
        }
        await endLink();
      } catch (error) {
        setFormError(authErrorMessage(error));
      }
    });

  return (
    <AuthScreen
      title="Choose a new password"
      footer={
        <AuthLink
          label="Cancel and sign out"
          onPress={() => void cancelling.run(signOut)}
          running={cancelling.running}
          disabled={running}
        />
      }
    >
      {session?.user.email ? (
        <AccountEmail prefix="Changing the password for" email={session.user.email} />
      ) : null}
      <PasswordField
        label="New password"
        value={password}
        onChangeText={setPassword}
        error={fieldError}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <FormMessage message={formError} />
      <GradientButton
        label="Save new password"
        onPress={submit}
        running={running}
        disabled={cancelling.running}
      />
    </AuthScreen>
  );
}
