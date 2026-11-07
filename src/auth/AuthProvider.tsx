import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/auth-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { sendHeldCheckin } from '../api/client';
import {
  deriveAuthStatus,
  storedSessionIsUsable,
  type AuthStatus,
  type PendingLink,
} from './authStatus';
import { secureSessionStorage } from './secureSessionStorage';
import { resetSessionExpiry, setSessionExpiredHandler } from './sessionExpiry';
import { getAuth, SESSION_STORAGE_KEY } from './supabase';

const PENDING_LINK_KEY = 'breathease_pending_link';

function readPendingLink(raw: string | null): PendingLink | null {
  return raw === 'recovery' || raw === 'linkConfirm' ? raw : null;
}

async function hasUnrestoredSession(): Promise<boolean> {
  return storedSessionIsUsable(await secureSessionStorage.getItem(SESSION_STORAGE_KEY));
}

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  // Call before verifyOtp. A kill between the two then lands back on the right
  // screen instead of in Home.
  beginLink: (link: PendingLink) => Promise<void>;
  // Call when the link failed, or when the user finished that screen.
  endLink: () => Promise<void>;
  retryRestore: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [unrestored, setUnrestored] = useState(false);

  useEffect(() => {
    let active = true;

    async function finishStartup(initial: Session | null) {
      const pending = readPendingLink(await AsyncStorage.getItem(PENDING_LINK_KEY));
      const stranded = initial ? false : await hasUnrestoredSession();
      if (!active) return;

      // A flag with no session means the app died before verifyOtp finished.
      if (pending && !initial && !stranded) {
        await AsyncStorage.removeItem(PENDING_LINK_KEY);
        setPendingLink(null);
      } else {
        setPendingLink(pending);
      }
      setUnrestored(stranded);
      setReady(true);
    }

    // No auth calls inside this callback: auth-js holds a lock here, so
    // awaiting one can deadlock. Startup work is pushed out of it.
    const {
      data: { subscription },
    } = getAuth().onAuthStateChange((event, next) => {
      setSession(next);
      if (next) setUnrestored(false);

      if (event === 'INITIAL_SESSION') {
        setTimeout(() => void finishStartup(next), 0);
      } else if (event === 'SIGNED_IN' && next) {
        resetSessionExpiry();
        const userId = next.user.id;
        setTimeout(() => void sendHeldCheckin(userId), 0);
      } else if (event === 'SIGNED_OUT') {
        setUnrestored(false);
        setPendingLink(null);
        void AsyncStorage.removeItem(PENDING_LINK_KEY);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const beginLink = useCallback(async (link: PendingLink) => {
    await AsyncStorage.setItem(PENDING_LINK_KEY, link);
    setPendingLink(link);
  }, []);

  const endLink = useCallback(async () => {
    await AsyncStorage.removeItem(PENDING_LINK_KEY);
    setPendingLink(null);
  }, []);

  const retryRestore = useCallback(async () => {
    const { data } = await getAuth().getSession();
    setSession(data.session);
    setUnrestored(data.session ? false : await hasUnrestoredSession());
  }, []);

  // auth-js can return early and leave the session stored when the network is
  // down, so the stored copy is always cleared here as well.
  const signOut = useCallback(async () => {
    try {
      await getAuth().signOut({ scope: 'local' });
    } catch {
      // Falls through: a local sign-out must still happen with no signal.
    }
    await secureSessionStorage.removeItem(SESSION_STORAGE_KEY);
    await AsyncStorage.removeItem(PENDING_LINK_KEY);
    setSession(null);
    setUnrestored(false);
    setPendingLink(null);
  }, []);

  useEffect(() => setSessionExpiredHandler(signOut), [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: deriveAuthStatus({
        ready,
        hasSession: session !== null,
        pendingLink,
        hasUnrestoredSession: unrestored,
      }),
      session,
      beginLink,
      endLink,
      retryRestore,
      signOut,
    }),
    [ready, session, pendingLink, unrestored, beginLink, endLink, retryRestore, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
