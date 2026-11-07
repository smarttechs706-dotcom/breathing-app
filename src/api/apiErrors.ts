// The one place that decides what an API failure means to the user. Screens
// show friendlyError(err) and never a raw status or server message.

export const API_MESSAGES = {
  sessionExpired: 'Please sign in again.',
  unavailable: "Can't reach the server, try again",
  rateLimited: 'Too many requests, wait a moment.',
  generic: 'Something went wrong. Please try again.',
} as const;

// Status 0 means no reply at all: no network, or the request timed out.
export const NO_REPLY = 0;

export class ApiError extends Error {
  status: number;

  constructor(label: string, status: number) {
    super(status === NO_REPLY ? `${label} got no reply` : `${label} failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

function statusOf(error: unknown): number | undefined {
  const { status } = (error ?? {}) as { status?: unknown };
  return typeof status === 'number' ? status : undefined;
}

export function isSessionExpired(error: unknown): boolean {
  return statusOf(error) === 401;
}

export function friendlyError(error: unknown): string {
  switch (statusOf(error)) {
    case 401:
      return API_MESSAGES.sessionExpired;
    case 429:
      return API_MESSAGES.rateLimited;
    case 503:
    case NO_REPLY:
      return API_MESSAGES.unavailable;
    default:
      return API_MESSAGES.generic;
  }
}

// True when a failed token refresh never got an answer, which says nothing
// about the session, so it must not sign the user out. Duck typed so this file
// stays free of supabase-js imports.
export function isAuthNetworkFailure(error: unknown): boolean {
  const { name } = (error ?? {}) as { name?: unknown };
  return name === 'AuthRetryableFetchError' || name === 'AbortError' || name === 'TypeError';
}
