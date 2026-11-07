import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { API_MESSAGES } from '../../src/api/apiErrors';
import { AUTH_MESSAGES, authErrorMessage } from '../../src/auth/authErrors';
import { setPendingEmail } from '../../src/auth/pendingEmail';
import { consumeSignInNotice } from '../../src/auth/sessionExpiry';
import { getAuth } from '../../src/auth/supabase';
import { useSingleFlight } from '../../src/auth/useSingleFlight';
import { isValidEmail, normalizeEmail } from '../../src/auth/validation';
import { AuthLink } from '../../src/components/auth/AuthLink';
import { AuthScreen } from '../../src/components/auth/AuthScreen';
import { FormMessage } from '../../src/components/auth/FormMessage';
import { GradientButton } from '../../src/components/auth/GradientButton';
import { PasswordField } from '../../src/components/auth/PasswordField';
import { TextField } from '../../src/components/auth/TextField';

type Errors = { email?: string; password?: string; form?: string };

export default function LoginScreen() {
  const { running, run } = useSingleFlight();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>(() =>
    consumeSignInNotice() ? { form: API_MESSAGES.sessionExpired } : {}
  );
  const [needsConfirming, setNeedsConfirming] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // No navigation on success: the session flips the route guard, which
  // removes this screen, so Back cannot return to it.
  const submit = () =>
    run(async () => {
      const address = normalizeEmail(email);
      const next: Errors = {};
      if (!isValidEmail(address)) next.email = AUTH_MESSAGES.enterEmail;
      if (!password) next.password = AUTH_MESSAGES.enterPassword;
      setErrors(next);
      setNeedsConfirming(false);
      if (Object.keys(next).length > 0) return;

      try {
        const { error } = await getAuth().signInWithPassword({ email: address, password });
        if (error) {
          setErrors({ form: authErrorMessage(error) });
          setNeedsConfirming(error.code === 'email_not_confirmed');
        }
      } catch (error) {
        setErrors({ form: authErrorMessage(error) });
      }
    });

  function openResend() {
    setPendingEmail(normalizeEmail(email));
    router.push('/check-email');
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <AuthLink
          prompt="New here?"
          label="Create an account"
          onPress={() => router.replace('/signup')}
        />
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <PasswordField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <FormMessage message={errors.form ?? null} />
      {needsConfirming ? <AuthLink label="Resend the link" onPress={openResend} /> : null}
      <GradientButton label="Log in" onPress={submit} running={running} />
      <AuthLink label="Forgot password?" onPress={() => router.push('/forgot-password')} />
    </AuthScreen>
  );
}
