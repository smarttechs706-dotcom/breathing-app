import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { secureSessionStorage } from './secureSessionStorage';

// AUTH ONLY. Only `getAuth()` leaves this file, never the client, so app code
// cannot reach .from(), .rpc() or storage. All data goes through the Next.js
// API with a Bearer token.

export const SESSION_STORAGE_KEY = 'breathease-auth';

const AUTH_TIMEOUT_MS = 15_000;

// Every auth call is bounded, same reasoning as timedFetch in src/api/client.ts:
// a stalled connection must not leave a spinner running forever.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

let client: SupabaseClient | null = null;

// SPIKE: built on first use and throws a readable error, so a missing env
// value shows on the spike screen instead of crashing the whole app at import.
function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.'
    );
  }

  client = createClient(url, publishableKey, {
    auth: {
      flowType: 'implicit',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: secureSessionStorage,
      storageKey: SESSION_STORAGE_KEY,
    },
    global: { fetch: fetchWithTimeout },
  });

  // Refresh only while the app is in the foreground (Supabase's Expo guide).
  if (Platform.OS !== 'web') {
    const created = client;
    AppState.addEventListener('change', (state) => {
      if (state === 'active') created.auth.startAutoRefresh();
      else created.auth.stopAutoRefresh();
    });
  }

  return client;
}

export function getAuth() {
  return getClient().auth;
}
