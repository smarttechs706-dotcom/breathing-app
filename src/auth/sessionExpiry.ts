// A 401 means the session is over. Home alone sends two requests at once, so
// the first report signs out and the rest do nothing until the next login.

type Handler = () => void | Promise<void>;

let handler: Handler | null = null;
let reported = false;
let noticePending = false;

// AuthProvider registers its signOut here, because src/api/client.ts cannot
// reach React context. Returns the function that unregisters it.
export function setSessionExpiredHandler(next: Handler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function reportSessionExpired(): void {
  if (reported) return;
  reported = true;
  noticePending = true;
  try {
    Promise.resolve(handler?.()).catch(() => {});
  } catch {
    // Signing out must never turn into a second failure for the caller.
  }
}

export function resetSessionExpiry(): void {
  reported = false;
}

// Log in reads this once, so "Please sign in again." shows a single time and
// never passes through route params.
export function consumeSignInNotice(): boolean {
  const pending = noticePending;
  noticePending = false;
  return pending;
}
