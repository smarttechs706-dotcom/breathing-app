import { router } from 'expo-router';
import { useState } from 'react';

import { AUTH_MESSAGES, authErrorMessage } from '../../src/auth/authErrors';
import { AUTH_REDIRECT_URL } from '../../src/auth/deepLink';
import { getPendingEmail, setPendingEmail } from '../../src/auth/pendingEmail';
import { getAuth } from '../../src/auth/supabase';
import { useCooldown } from '../../src/auth/useCooldown';
import { useSingleFlight } from '../../src/auth/useSingleFlight';
import { isValidEmail, normalizeEmail } from '../../src/auth/validation';
import { AuthLink } from '../../src/components/auth/AuthLink';
import { AuthScreen } from '../../src/components/auth/AuthScreen';
import { FormMessage } from '../../src/components/auth/FormMessage';
import { GradientButton } from '../../src/components/auth/GradientButton';
import { TextField } from '../../src/components/auth/TextField';

export default function CheckEmailScreen() {
  const { running, run } = useSingleFlight();
  const { secondsLeft, start } = useCooldown('resend');
  // Empty when an expired link led here, so the address is asked for instead.
  const [knownEmail] = useState(getPendingEmail);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const resend = () =>
    run(async () => {
      const address = knownEmail ?? normalizeEmail(email);
      setFormError(null);
      if (!isValidEmail(address)) {
        setEmailError(AUTH_MESSAGES.enterEmail);
        return;
      }
      setEmailError(null);

      try {
        const { error } = await getAuth().resend({
          type: 'signup',
          email: address,
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        });
        const message = error ? authErrorMessage(error) : null;
        // Same rule as Forgot password: anything else stays neutral.
        if (message === AUTH_MESSAGES.offline) {
          setFormError(message);
          return;
        }
        setPendingEmail(address);
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
      title="Check your email"
      subtitle={`${AUTH_MESSAGES.checkEmail}. Tap the link, then choose Open in app.`}
      backTo="/signup"
      footer={
        <AuthLink
          prompt="Already have an account?"
          label="Log in"
          onPress={() => router.replace('/login')}
        />
      }
    >
      {knownEmail ? null : (
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
        />
      )}
      {sent ? <FormMessage message={AUTH_MESSAGES.resendSent} tone="info" /> : null}
      <FormMessage message={formError} />
      <GradientButton
        label={secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend the link'}
        onPress={resend}
        running={running}
        disabled={secondsLeft > 0}
      />
    </AuthScreen>
  );
}
