import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { AUTH_MESSAGES, authErrorMessage, isAccountExistsError } from '../../src/auth/authErrors';
import { startCooldown } from '../../src/auth/cooldown';
import { AUTH_REDIRECT_URL } from '../../src/auth/deepLink';
import { setPendingEmail } from '../../src/auth/pendingEmail';
import { getAuth } from '../../src/auth/supabase';
import { useSingleFlight } from '../../src/auth/useSingleFlight';
import {
  isValidEmail,
  isValidNewPassword,
  normalizeEmail,
  normalizeFirstName,
} from '../../src/auth/validation';
import { AuthLink } from '../../src/components/auth/AuthLink';
import { AuthScreen } from '../../src/components/auth/AuthScreen';
import { FormMessage } from '../../src/components/auth/FormMessage';
import { GradientButton } from '../../src/components/auth/GradientButton';
import { PasswordField } from '../../src/components/auth/PasswordField';
import { TextField } from '../../src/components/auth/TextField';

type Errors = { firstName?: string; email?: string; password?: string; form?: string };

export default function SignupScreen() {
  const { running, run } = useSingleFlight();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Every outcome that is not a real failure ends on the same screen, whether
  // or not the address already has an account. The reply is never inspected.
  function finish(address: string) {
    setPendingEmail(address);
    startCooldown('resend');
    router.replace('/check-email');
  }

  const submit = () =>
    run(async () => {
      const name = normalizeFirstName(firstName);
      const address = normalizeEmail(email);
      const next: Errors = {};
      if (!name) next.firstName = AUTH_MESSAGES.enterFirstName;
      if (!isValidEmail(address)) next.email = AUTH_MESSAGES.enterEmail;
      if (!isValidNewPassword(password)) next.password = AUTH_MESSAGES.weakPassword;
      setErrors(next);
      if (Object.keys(next).length > 0) return;

      try {
        const { error } = await getAuth().signUp({
          email: address,
          password,
          options: { data: { display_name: name }, emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (error && !isAccountExistsError(error)) {
          setErrors({ form: authErrorMessage(error) });
          return;
        }
        finish(address);
      } catch (error) {
        setErrors({ form: authErrorMessage(error) });
      }
    });

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Your sessions and streak stay with you on any phone."
      backTo="/login"
      footer={
        <AuthLink
          prompt="Already have an account?"
          label="Log in"
          onPress={() => router.replace('/login')}
        />
      }
    >
      <TextField
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        error={errors.firstName}
        autoCapitalize="words"
        autoComplete="name-given"
        textContentType="givenName"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
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
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <FormMessage message={errors.form ?? null} />
      <GradientButton label="Create account" onPress={submit} running={running} />
    </AuthScreen>
  );
}
