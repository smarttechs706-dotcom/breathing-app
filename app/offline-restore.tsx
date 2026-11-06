import { useState } from 'react';

import { AUTH_MESSAGES } from '../src/auth/authErrors';
import { useAuth } from '../src/auth/AuthProvider';
import { useSingleFlight } from '../src/auth/useSingleFlight';
import { AuthScreen } from '../src/components/auth/AuthScreen';
import { FormMessage } from '../src/components/auth/FormMessage';
import { GradientButton } from '../src/components/auth/GradientButton';

// A session is stored but could not be refreshed. That usually means no
// signal, and Log in would wrongly suggest the account was lost.
export default function OfflineRestoreScreen() {
  const { retryRestore } = useAuth();
  const { running, run } = useSingleFlight();
  const [retried, setRetried] = useState(false);

  const retry = () =>
    run(async () => {
      await retryRestore();
      setRetried(true);
    });

  return (
    <AuthScreen title="You're offline" subtitle="You're still signed in. Reconnect to continue.">
      {retried ? <FormMessage message={AUTH_MESSAGES.offline} /> : null}
      <GradientButton label="Retry" onPress={retry} running={running} />
    </AuthScreen>
  );
}
