import Constants, { ExecutionEnvironment } from 'expo-constants';

import { getAuth } from '../auth/supabase';
import { reportSessionExpired } from '../auth/sessionExpiry';
import { markCheckinSaved } from '../state/checkinSignal';
import { holdCheckin, takeHeldCheckin, type CheckinPayload } from '../state/pendingCheckin';
import type { Checkin, Session, Streak } from '../types/models';
import { ApiError, isAuthNetworkFailure, isSessionExpired, NO_REPLY } from './apiErrors';

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
// The check-in save gets longer: on-device a save took 4-13 s on a cold API,
// and timing out a save the user just finished is worse than waiting.
export const CHECKIN_TIMEOUT_MS = 20_000;
// Deleting an account does more work than a read, and giving up early would
// report a failure for a delete that actually happened.
export const DELETE_TIMEOUT_MS = 20_000;

type RequestOptions = Omit<RequestInit, 'headers' | 'signal'> & {
  headers?: Record<string, string>;
};

async function timedFetch<T>(
  label: string,
  url: URL,
  init: RequestOptions | undefined,
  handle: (response: Response) => Promise<T>,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(url.toString(), { ...init, signal: controller.signal });
    } catch {
      throw new ApiError(label, NO_REPLY);
    }
    if (!response.ok) throw new ApiError(label, response.status);
    return await handle(response);
  } catch (err) {
    if (controller.signal.aborted) throw new ApiError(label, NO_REPLY);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// getSession() refreshes an expired token, so the token sent here is current.
// A refresh that got no answer is offline. A refresh the server refused, or no
// session at all, is the same as a 401.
async function currentSession(label: string) {
  let result: Awaited<ReturnType<ReturnType<typeof getAuth>['getSession']>>;
  try {
    result = await getAuth().getSession();
  } catch {
    throw new ApiError(label, NO_REPLY);
  }

  const { data, error } = result;
  if (error && isAuthNetworkFailure(error)) throw new ApiError(label, NO_REPLY);
  if (!data.session) {
    reportSessionExpired();
    throw new ApiError(label, 401);
  }
  return data.session;
}

// Identity comes only from this token: the API ignores any id in the URL or
// body, so none is ever sent. `onExpired` runs before the sign-out starts.
export async function authedFetch<T>(
  label: string,
  url: URL,
  init: RequestOptions | undefined,
  handle: (response: Response) => Promise<T>,
  timeoutMs?: number,
  onExpired?: (userId: string) => void
): Promise<T> {
  const session = await currentSession(label);
  const authed: RequestOptions = {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${session.access_token}` },
  };

  try {
    return await timedFetch(label, url, authed, handle, timeoutMs);
  } catch (err) {
    if (isSessionExpired(err)) {
      onExpired?.(session.user.id);
      reportSessionExpired();
    }
    throw err;
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

  return timedFetch('GET /api/sessions', url, undefined, async (response) =>
    parseSessions(await response.json())
  );
}

function sendCheckin(
  checkin: CheckinPayload,
  onExpired?: (userId: string) => void
): Promise<Streak> {
  const { sessionId, preMood, postMood } = checkin;
  return authedFetch(
    'POST /api/checkin',
    new URL('/api/checkin', getApiBaseUrl()),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, preMood, postMood }),
    },
    (response) => response.json(),
    CHECKIN_TIMEOUT_MS,
    onExpired
  );
}

export function postCheckin(checkin: CheckinPayload): Promise<Streak> {
  return sendCheckin(checkin, (userId) => holdCheckin(userId, checkin));
}

// Sends a check-in held by a 401 once the same user is back. One attempt only:
// a failure here has no screen to show it on, and must not double-post later.
export async function sendHeldCheckin(userId: string): Promise<void> {
  const checkin = takeHeldCheckin(userId);
  if (!checkin) return;
  try {
    await sendCheckin(checkin);
    markCheckinSaved();
  } catch {
    // See above.
  }
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

export async function fetchInsights(): Promise<InsightsResponse> {
  const url = new URL('/api/insights', getApiBaseUrl());

  return authedFetch('GET /api/insights', url, undefined, async (response) =>
    parseInsights(await response.json())
  );
}

// DELETE /api/user removes the caller's check-ins, streak and account. Success
// is any 2xx; the body is not relied on (D-04: don't trust response shapes).
// Safe to retry: the token outlives the account, and a repeat returns the same
// reply. Limits: 5/min per account.
export async function deleteUserData(): Promise<void> {
  const url = new URL('/api/user', getApiBaseUrl());

  await authedFetch(
    'DELETE /api/user',
    url,
    { method: 'DELETE' },
    async () => undefined,
    DELETE_TIMEOUT_MS
  );
}
