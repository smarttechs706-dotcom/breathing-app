// A check-in that hit a 401 is held here, in memory only, so a finished session
// survives having to log in again. It belongs to one user and is handed over
// once: any login clears it, so another account can never post it.

export type CheckinPayload = {
  sessionId: string;
  preMood: number;
  postMood: number;
  // Seconds actually played (60 to 600). Optional: left out, the server counts
  // the catalogue length, as it always has.
  durationSec?: number;
};

let held: { userId: string; checkin: CheckinPayload } | null = null;

export function holdCheckin(userId: string, checkin: CheckinPayload): void {
  held = { userId, checkin };
}

export function takeHeldCheckin(userId: string): CheckinPayload | null {
  const current = held;
  held = null;
  return current?.userId === userId ? current.checkin : null;
}
