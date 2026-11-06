import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { AUTH_MESSAGES, authErrorMessage } from '../../src/auth/authErrors';
import { useAuth } from '../../src/auth/AuthProvider';
import { parseAuthLink, type AuthLink as ParsedLink } from '../../src/auth/deepLink';
import { getAuth } from '../../src/auth/supabase';
import { useSingleFlight } from '../../src/auth/useSingleFlight';
import { AccountEmail } from '../../src/components/auth/AccountEmail';
import { AuthLink } from '../../src/components/auth/AuthLink';
import { AuthScreen } from '../../src/components/auth/AuthScreen';
import { FormMessage } from '../../src/components/auth/FormMessage';
import { GradientButton } from '../../src/components/auth/GradientButton';

// Every email link lands here, outside all route guards. A link can only ever
// verify: nothing destructive runs from one, and an existing session is never
// replaced without asking.
type Phase = 'checking' | 'confirmReplace' | 'expired' | 'failed' | 'invalid';

// Android can deliver the same link twice, and links are single use.
let lastHandledHash: string | null = null;

export default function AuthCallback() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const { status, session, beginLink, endLink, signOut } = useAuth();
  const { running, run } = useSingleFlight();
  const [phase, setPhase] = useState<Phase>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  const link = parseAuthLink(params.token_hash, params.type);
  const isRecovery = link?.type === 'recovery';

  async function redeem(target: ParsedLink) {
    lastHandledHash = target.tokenHash;
    // Before verifyOtp on purpose: the session it creates must never be seen
    // as a plain login, even for a moment or after a kill.
    await beginLink(target.type === 'recovery' ? 'recovery' : 'linkConfirm');

    let failure: unknown = null;
    try {
      const { data, error } = await getAuth().verifyOtp({
        token_hash: target.tokenHash,
        type: target.type,
      });
      if (error) failure = error;
      else if (!data.session) failure = {};
    } catch (error) {
      failure = error;
    }

    if (failure === null) {
      router.replace('/');
      return;
    }

    await endLink();
    const text = authErrorMessage(failure);
    setMessage(text);
    setPhase(text === AUTH_MESSAGES.linkExpired ? 'expired' : 'failed');
  }

  const start = (target: ParsedLink) => run(() => redeem(target));

  useEffect(() => {
    if (status === 'loading' || started.current) return;
    started.current = true;

    if (!link || lastHandledHash === link.tokenHash) {
      setPhase('invalid');
      return;
    }
    if (status === 'signedOut') {
      void start(link);
      return;
    }
    setPhase('confirmReplace');
  }, [status]);

  const useThisLink = () =>
    run(async () => {
      if (!link) return;
      await signOut();
      await redeem(link);
    });

  const retry = () => {
    if (link) void start(link);
  };

  if (phase === 'confirmReplace') {
    return (
      <AuthScreen title="You're already signed in" subtitle="Use this link to switch accounts?">
        {session?.user.email ? (
          <AccountEmail prefix="Signed in as" email={session.user.email} />
        ) : null}
        <GradientButton label="Use this link" onPress={useThisLink} running={running} />
        <AuthLink
          label="Stay signed in"
          onPress={() => router.replace('/')}
          disabled={running}
        />
      </AuthScreen>
    );
  }

  if (phase === 'expired') {
    return (
      <AuthScreen title={AUTH_MESSAGES.linkExpired}>
        <GradientButton label="Log in" onPress={() => router.replace('/login')} />
        <AuthLink
          label="Send a new link"
          onPress={() => router.replace(isRecovery ? '/forgot-password' : '/check-email')}
        />
      </AuthScreen>
    );
  }

  if (phase === 'failed') {
    return (
      <AuthScreen title="That didn't work">
        <FormMessage message={message} />
        <GradientButton label="Try again" onPress={retry} running={running} />
        <AuthLink label="Back" onPress={() => router.replace('/')} disabled={running} />
      </AuthScreen>
    );
  }

  if (phase === 'invalid') {
    return (
      <AuthScreen title={AUTH_MESSAGES.linkInvalid}>
        <GradientButton label="Continue" onPress={() => router.replace('/')} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Checking your link" subtitle="This only takes a moment.">
      <GradientButton label="Checking" onPress={() => undefined} running />
    </AuthScreen>
  );
}
