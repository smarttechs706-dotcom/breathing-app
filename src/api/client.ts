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

export async function fetchSessions(category?: Session['category']): Promise<Session[]> {
  const url = new URL('/api/sessions', getApiBaseUrl());
  if (category) {
    url.searchParams.set('category', category);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`GET /api/sessions failed: ${response.status}`);
  }

  return response.json();
}

export async function postCheckin(payload: {
  userId: string;
  sessionId: string;
  preMood: number;
  postMood: number;
}): Promise<Streak> {
  const url = new URL('/api/checkin', getApiBaseUrl());

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`POST /api/checkin failed: ${response.status}`);
  }

  return response.json();
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

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`GET /api/insights failed: ${response.status}`);
  }

  return response.json();
}

// DELETE /api/user — removes this device's check-ins and streak from the
// server. Success is any 2xx; the body ({deleted:{checkins,streaks}}) is not
// relied on (D-04: don't trust response shapes). Limits: 5/min per id.
export async function deleteUserData(userId: string): Promise<void> {
  const url = new URL('/api/user', getApiBaseUrl());
  url.searchParams.set('user_id', userId);

  const response = await fetch(url.toString(), { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`DELETE /api/user failed: ${response.status}`);
  }
}
