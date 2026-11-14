// F-02 (DEEP-AUDIT-3): the Session Player used to count 1-second interval
// ticks, so any stalled/throttled timer (screen off, app frozen) made the
// session longer than its stated duration. This clock derives elapsed time
// from timestamps instead: it only accumulates while "running" (active phase,
// not paused, screen focused, app in the foreground) and a late timer can
// only make the display late, never make the session longer.
//
// Heartbeat (2026-11-15): stopping the clock used to be stamped with the time
// the stop was *processed*. On Android, JS timers and re-renders are held back
// while the app is in the background, so a stop that arrived only on unlock
// counted the whole locked period as breathing time. Now the player calls
// beat() on every tick (at least once a second while the session is on
// screen), and time is only counted up to the last beat whenever there has
// been a gap longer than MAX_GAP_MS: unobserved time never counts. A lock
// costs at most about one second of real breathing time.
//
// Pure functions over a plain state object (no timers, no Date.now() inside)
// so the logic can be tested with a fake clock (tests/session/sessionClock.test.cjs).

export interface ClockState {
  /** Milliseconds accumulated over all finished running periods. */
  accumulatedMs: number;
  /** Timestamp the current running period began, or null while stopped. */
  runStartedAt: number | null;
  /** Timestamp of the last beat in the current running period, or null while stopped. */
  lastBeatAt: number | null;
}

export const INITIAL_CLOCK: ClockState = { accumulatedMs: 0, runStartedAt: null, lastBeatAt: null };

// Ticks come at least once a second while the session is on screen; a longer
// gap than this means the app was not running (locked, backgrounded, frozen).
export const MAX_GAP_MS = 2500;

// The end of the time that was actually observed: `now`, or the last beat if
// nothing has been seen for longer than MAX_GAP_MS.
function observedUntil(state: ClockState, now: number): number {
  if (state.runStartedAt === null) return now;
  const last = state.lastBeatAt ?? state.runStartedAt;
  return now - last > MAX_GAP_MS ? last : now;
}

/** Start or stop the clock. Idempotent: repeating the same state is a no-op. */
export function setRunning(state: ClockState, running: boolean, now: number): ClockState {
  if (running) {
    return state.runStartedAt === null ? { ...state, runStartedAt: now, lastBeatAt: now } : state;
  }
  if (state.runStartedAt === null) return state;
  const until = observedUntil(state, now);
  return {
    accumulatedMs: state.accumulatedMs + Math.max(0, until - state.runStartedAt),
    runStartedAt: null,
    lastBeatAt: null,
  };
}

/**
 * Called on every tick while running. After a gap longer than MAX_GAP_MS the
 * time up to the last beat is kept, the gap is dropped, and a new running
 * period starts now.
 */
export function beat(state: ClockState, now: number): ClockState {
  if (state.runStartedAt === null) return state;
  const last = state.lastBeatAt ?? state.runStartedAt;
  if (now - last > MAX_GAP_MS) {
    return {
      accumulatedMs: state.accumulatedMs + Math.max(0, last - state.runStartedAt),
      runStartedAt: now,
      lastBeatAt: now,
    };
  }
  return { ...state, lastBeatAt: Math.max(last, now) };
}

export function elapsedMs(state: ClockState, now: number): number {
  if (state.runStartedAt === null) return state.accumulatedMs;
  return state.accumulatedMs + Math.max(0, observedUntil(state, now) - state.runStartedAt);
}

export function elapsedSeconds(state: ClockState, now: number): number {
  return Math.floor(elapsedMs(state, now) / 1000);
}
