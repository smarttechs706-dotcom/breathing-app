import type { Session } from '../types/models';

// Last successfully fetched GET /api/sessions result, shared across screens
// so Session Player can render immediately with the list Library (or the
// Player tab) already fetched instead of blocking on an identical request
// (PRODUCTION-READINESS-AUDIT.md P4). Plain module state, in-memory only —
// empty on a cold start / deep link, in which case callers fall back to
// fetching as before.
let cached: Session[] | null = null;

export function getCachedSessions(): Session[] | null {
  return cached;
}

export function setCachedSessions(sessions: Session[]): void {
  cached = sessions;
}
