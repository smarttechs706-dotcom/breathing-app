// The single place that decides which part of the app a user may see. Pure, so
// each state can be checked without a device.

export type AuthStatus =
  | 'loading'
  | 'signedOut'
  | 'signedIn'
  | 'recovery'
  | 'linkConfirm'
  | 'offlineRestore';

// A link started this. Stored before verifyOtp runs, because a session from a
// link looks like a normal login and would otherwise go straight into Home.
export type PendingLink = 'recovery' | 'linkConfirm';

export function deriveAuthStatus(state: {
  ready: boolean;
  hasSession: boolean;
  pendingLink: PendingLink | null;
  hasUnrestoredSession: boolean;
}): AuthStatus {
  if (!state.ready) return 'loading';
  if (state.hasSession) return state.pendingLink ?? 'signedIn';
  // No session in memory but one in storage means the refresh failed, most
  // often from no signal. That is not the same as being signed out.
  return state.hasUnrestoredSession ? 'offlineRestore' : 'signedOut';
}

// True only if the stored session could still be refreshed. Malformed data
// counts as no session, so the user logs in again rather than being stuck.
export function storedSessionIsUsable(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { refresh_token?: unknown };
    return typeof parsed.refresh_token === 'string' && parsed.refresh_token.length > 0;
  } catch {
    return false;
  }
}
