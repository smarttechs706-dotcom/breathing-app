import { useAuth } from '../../src/auth/AuthProvider';
import { useSingleFlight } from '../../src/auth/useSingleFlight';
import { AccountEmail } from '../../src/components/auth/AccountEmail';
import { AuthLink } from '../../src/components/auth/AuthLink';
import { AuthScreen } from '../../src/components/auth/AuthScreen';
import { GradientButton } from '../../src/components/auth/GradientButton';

// Shown once after an email link, so someone tapping a link sent by another
// person can see whose account this is. Log in with a password skips it. The
// guard handles navigation for both buttons.
export default function SignedInScreen() {
  const { session, endLink, signOut } = useAuth();
  const continuing = useSingleFlight();
  const leaving = useSingleFlight();

  return (
    <AuthScreen title="You're in">
      {session?.user.email ? (
        <AccountEmail prefix="Signed in as" email={session.user.email} />
      ) : null}
      <GradientButton
        label="Continue"
        onPress={() => void continuing.run(endLink)}
        running={continuing.running}
        disabled={leaving.running}
      />
      <AuthLink
        label="Sign out"
        prompt="Not you?"
        onPress={() => void leaving.run(signOut)}
        running={leaving.running}
        disabled={continuing.running}
      />
    </AuthScreen>
  );
}
