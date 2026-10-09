import Constants, { ExecutionEnvironment } from 'expo-constants';

import type { Checkin, Session, Streak } from '../types/models';

// The Next.js API (breathing-app-api) base URL. Per architecture.md, this
// app never talks to Supabase directly — everything goes through that API.
//
// Defaults to localhost for local dev (Expo web / simulator running on the
// same machine as breathing-app-api's `npm run dev`). This will NOT work
// from a physical device over Expo Go — "localhost" there resolves to the
// phone itself, not the dev machine. Set EXPO_PUBLIC_API_BASE_URL to the
// dev machine's LAN IP (e.g. http://192.168.1.23:3000) for on-device
// testing. Vercel deployment (architecture.md build order step 8) will
// replace this default with the deployed URL.
//
// Release builds (not Metro/dev client, not Expo Go) refuse to run without a
// real https:// URL instead of silently falling back to localhost, which on
// a phone is the phone itself (PRODUCTION-READINESS-AUDIT.md S1). EAS sets
// this per build profile (see eas.json / `eas env:list`); the preview and
// production placeholders end in `.invalid` on purpose so an unconfigured
// build fails loudly here.
const isReleaseBuild =
  !__DEV__ && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const RAW_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export function getApiBaseUrl(): string {
  if (!isReleaseBuild) return RAW_API_BASE_URL ?? 'http://localhost:3000';

  if (!RAW_API_BASE_URL || !RAW_API_BASE_URL.startsWith('https://')) {
    throw new Error(
      `API base URL is missing or not https:// (got: ${RAW_API_BASE_URL ?? 'undefined'}). ` +
        'Set EXPO_PUBLIC_API_BASE_URL for this EAS build profile.'
    );
  }
  if (new URL(RAW_API_BASE_URL).hostname.endsWith('.invalid')) {
    throw new Error(
      'API base URL is still the placeholder (.invalid). Set the real API URL for this build profile.'
    );
  }
  return RAW_API_BASE_URL;
}

// F-09 / F-03 (DEEP-AUDIT-3): every request is bounded. A stalled connection
// used to leave spinners (and the Session Player's `saving` state) running
// forever. The abort covers reading the body too, and turns into an ordinary
// Error, so each screen's existing error + Retry UI handles it.
export const REQUEST_TIMEOUT_MS = 10_000;

async function timedFetch<T>(
  label: string,
  url: URL,
  init: RequestInit | undefined,
  handle: (response: Response) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { ...init, signal: controller.signal });
    return await handle(response);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS / 1000} s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSessions(category?: Session['category']): Promise<Session[]> {
  const url = new URL('/api/sessions', getApiBaseUrl());
  if (category) {
    url.searchParams.set('category', category);
  }

  return timedFetch('GET /api/sessions', url, undefined, async (response) => {
    if (!response.ok) {
      throw new Error(`GET /api/sessions failed: ${response.status}`);
    }
    return response.json();
  });
}

export async function postCheckin(payload: {
  userId: string;
  sessionId: string;
  preMood: number;
  postMood: number;
}): Promise<Streak> {
  const url = new URL('/api/checkin', getApiBaseUrl());

  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };

  return timedFetch('POST /api/checkin', url, init, async (response) => {
    if (!response.ok) {
      throw new Error(`POST /api/checkin failed: ${response.status}`);
    }
    return response.json();
  });
}

// Matches architecture.md's GET /api/insights response shape exactly.
export interface InsightsResponse {
  checkins: Checkin[];
  streak: Streak;
  totalSessions: number;
  sessionsThisWeek: number;
  mindfulMinutes: number;
  monthOverMonthDelta: number;
}

export async function fetchInsights(userId: string): Promise<InsightsResponse> {
  const url = new URL('/api/insights', getApiBaseUrl());
  url.searchParams.set('user_id', userId);

  return timedFetch('GET /api/insights', url, undefined, async (response) => {
    if (!response.ok) {
      throw new Error(`GET /api/insights failed: ${response.status}`);
    }
    return response.json();
  });
}

// DELETE /api/user — removes this device's check-ins and streak from the
// server. Success is any 2xx; the body ({deleted:{checkins,streaks}}) is not
// relied on (D-04: don't trust response shapes). Limits: 5/min per id.
export async function deleteUserData(userId: string): Promise<void> {
  const url = new URL('/api/user', getApiBaseUrl());
  url.searchParams.set('user_id', userId);

  await timedFetch('DELETE /api/user', url, { method: 'DELETE' }, async (response) => {
    if (!response.ok) {
      throw new Error(`DELETE /api/user failed: ${response.status}`);
    }
  });
}
