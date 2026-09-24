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
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export async function fetchSessions(category?: Session['category']): Promise<Session[]> {
  const url = new URL('/api/sessions', API_BASE_URL);
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
  const url = new URL('/api/checkin', API_BASE_URL);

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
  const url = new URL('/api/insights', API_BASE_URL);
  url.searchParams.set('user_id', userId);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`GET /api/insights failed: ${response.status}`);
  }

  return response.json();
}
