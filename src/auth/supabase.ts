import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { secureSessionStorage } from './secureSessionStorage';

// AUTH ONLY. Only `getAuth()` leaves this file, never the client, so app code
// cannot reach .from(), .rpc() or storage. All data goes through the Next.js
// API with a Bearer token.

export const SESSION_STORAGE_KEY = 'breathease-auth';

const AUTH_TIMEOUT_MS = 15_000;

// Expo only inlines EXPO_PUBLIC_ values read as these exact expressions.
const RAW_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const RAW_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Fails loudly in every build, at startup: an app that cannot reach auth has
// no usable path, so a silent failure later would only be harder to find. The
// messages name the setting and never echo its value.
function requireUrl(): string {
  if (!RAW_URL) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is missing. Set it for this build.');
  }
  if (!RAW_URL.startsWith('https://') || new URL(RAW_URL).hostname.endsWith('.invalid')) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not a real https:// URL. Set it for this build.');
  }
  return RAW_URL;
}

function requirePublishableKey(): string {
  if (!RAW_PUBLISHABLE_KEY) {
    throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Set it for this build.');
  }
  // Anything else is a placeholder or, worse, a server key in a public app.
  if (!RAW_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not a publishable key. Set it for this build.'
    );
  }
  return RAW_PUBLISHABLE_KEY;
}

// Every auth call is bounded, same reasoning as timedFetch in src/api/client.ts:
// a stalled connection must not leave a spinner running forever.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const client = createClient(requireUrl(), requirePublishableKey(), {
  auth: {
    // Not pkce: email links use verifyOtp with a token_hash, which never reads
    // the verifier. Proved on a device in the auth spike.
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
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}

export function getAuth() {
  return client.auth;
}
