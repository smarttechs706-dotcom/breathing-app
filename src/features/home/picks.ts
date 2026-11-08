import type { Session } from '../../types/models';

// Same rule as the current Home: Deep Exhale, else the first live session.
const FEATURED_SESSION_ID = 'deep-exhale';

// Approved for the preview: the three real sessions closest to the reference.
// Titles and durations always come from the live catalog, never from here.
export const NOW_FOR_YOU_IDS = ['morning-reset', 'calm-focus', 'stress-relief'] as const;

export function pickFeatured(sessions: readonly Session[]): Session | null {
  return sessions.find((s) => s.id === FEATURED_SESSION_ID) ?? sessions[0] ?? null;
}

// Keeps the order above and drops any id the catalog doesn't have, so a card
// can never point at a session that doesn't exist.
export function pickNowForYou(sessions: readonly Session[]): Session[] {
  return NOW_FOR_YOU_IDS.flatMap((id) => sessions.find((s) => s.id === id) ?? []);
}
