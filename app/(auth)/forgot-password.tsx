import { router } from 'expo-router';
import { useState } from 'react';

import { AUTH_MESSAGES, authErrorMessage } from '../../src/auth/authErrors';
import { AUTH_REDIRECT_URL } from '../../src/auth/deepLink';
import { getAuth } from '../../src/auth/supabase';
import { useCooldown } from '../../src/auth/useCooldown';
import { useSingleFlight } from '../../src/auth/useSingleFlight';
import { isValidEmail, normalizeEmail } from '../../src/auth/validation';
import { AuthLink } from '../../src/components/auth/AuthLink';
import { AuthScreen } from '../../src/components/auth/AuthScreen';
import { FormMessage } from '../../src/components/auth/FormMessage';
import { GradientButton } from '../../src/components/auth/GradientButton';
import { TextField } from '../../src/components/auth/TextField';

export default function ForgotPasswordScreen() {
  const { running, run } = useSingleFlight();
  const { secondsLeft, start } = useCooldown('forgot');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = () =>
    run(async () => {
      const address = normalizeEmail(email);
      setFormError(null);
      if (!isValidEmail(address)) {
        setEmailError(AUTH_MESSAGES.enterEmail);
        return;
      }
      setEmailError(null);

      try {
        const { error } = await getAuth().resetPasswordForEmail(address, {
          redirectTo: AUTH_REDIRECT_URL,
        });
        const message = error ? authErrorMessage(error) : null;
        // Only these two say nothing about the address, so only they show.
        // Anything else gets the same neutral reply as a success.
        if (message === AUTH_MESSAGES.offline) {
          setFormError(message);
          return;
        }
        start();
        if (message === AUTH_MESSAGES.rateLimited) {
          setFormError(message);
          return;
        }
        setSent(true);
      } catch (error) {
        setFormError(authErrorMessage(error));
      }
    });

  return (
    <AuthScreen
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link."
      backTo="/login"
      footer={
        <AuthLink
          prompt="Remembered it?"
          label="Log in"
          onPress={() => router.replace('/login')}
        />
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => {
          if (secondsLeft === 0) void submit();
        }}
      />
      {sent ? <FormMessage message={AUTH_MESSAGES.forgotSent} tone="info" /> : null}
      <FormMessage message={formError} />
      <GradientButton
        label={secondsLeft > 0 ? `Send again in ${secondsLeft}s` : 'Send link'}
        onPress={submit}
        running={running}
        disabled={secondsLeft > 0}
      />
    </AuthScreen>
  );
}
