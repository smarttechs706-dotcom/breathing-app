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

// F-08 / D-04 (DEEP-AUDIT-2/3): the client used to trust whatever JSON a 200
// carried, so a wrong-shaped body (bad deploy, captive portal, version skew)
// crashed a screen at render time -- and, via the sessions cache, kept
// crashing later screens until the app was restarted. Responses are now
// checked here, before anything is returned or cached. A bad body becomes an
// ordinary Error, which every screen already shows as error + Retry.
const CATEGORIES: readonly string[] = ['Calm', 'Sleep', 'Energy', 'Recovery'];
const BADGES: readonly string[] = ['Leaf', 'Moon', 'Zap', 'Heart'];
const PATTERNS: readonly string[] = ['rings', 'wave', 'starburst', 'dot-grid', 'spiral', 'bloom'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isMood = (v: unknown) => isNum(v) && Number.isInteger(v) && v >= 1 && v <= 5;

function isSession(v: unknown): v is Session {
  if (!isObj(v)) return false;
  const pc = v.phaseConfig;
  if (!isObj(pc)) return false;
  const phases = [pc.inhale, pc.hold, pc.exhale, pc.rest];
  return (
    isStr(v.id) &&
    isStr(v.title) &&
    isStr(v.description) &&
    isStr(v.category) && CATEGORIES.includes(v.category) &&
    isStr(v.badge) && BADGES.includes(v.badge) &&
    isStr(v.pattern) && PATTERNS.includes(v.pattern) &&
    isNum(v.durationSec) && v.durationSec > 0 &&
    // All four must be real numbers and not all zero (a 0 ms breath loop).
    phases.every((n) => isNum(n) && n >= 0) &&
    phases.some((n) => (n as number) > 0)
  );
}

function isCheckin(v: unknown): v is Checkin {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.sessionId) &&
    isMood(v.preMood) &&
    isMood(v.postMood) &&
    isStr(v.createdAt) &&
    !Number.isNaN(Date.parse(v.createdAt))
  );
}

export function parseSessions(data: unknown): Session[] {
  const fail = () => new Error('GET /api/sessions returned an unexpected response');
  if (!Array.isArray(data)) throw fail();
  const valid = data.filter(isSession);
  // Drop individual bad rows, but an all-bad list is a bad response.
  if (data.length > 0 && valid.length === 0) throw fail();
  return valid;
}

export function parseInsights(data: unknown): InsightsResponse {
  const fail = () => new Error('GET /api/insights returned an unexpected response');
  if (!isObj(data) || !Array.isArray(data.checkins) || !isObj(data.streak)) throw fail();
  const st = data.streak;
  if (
    !isNum(st.currentStreak) ||
    !isNum(st.longestStreak) ||
    !isNum(data.totalSessions) ||
    !isNum(data.sessionsThisWeek) ||
    !isNum(data.mindfulMinutes) ||
    !isNum(data.monthOverMonthDelta)
  ) {
    throw fail();
  }
  return {
    checkins: data.checkins.filter(isCheckin),
    streak: {
      userId: isStr(st.userId) ? st.userId : '',
      currentStreak: st.currentStreak,
      longestStreak: st.longestStreak,
      // '' is a legitimate value for a user with no streak row yet.
      lastSessionDate: isStr(st.lastSessionDate) ? st.lastSessionDate : '',
    },
    totalSessions: data.totalSessions,
    sessionsThisWeek: data.sessionsThisWeek,
    mindfulMinutes: data.mindfulMinutes,
    monthOverMonthDelta: data.monthOverMonthDelta,
  };
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
    return parseSessions(await response.json());
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
    return parseInsights(await response.json());
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
