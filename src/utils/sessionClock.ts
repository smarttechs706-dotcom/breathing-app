// F-02 (DEEP-AUDIT-3): the Session Player used to count 1-second interval
// ticks, so any stalled/throttled timer (screen off, app frozen) made the
// session longer than its stated duration. This clock derives elapsed time
// from timestamps instead: it only accumulates while "running" (active phase,
// not paused, screen focused, app in the foreground) and a late timer can
// only make the display late, never make the session longer.
//
// Pure functions over a plain state object (no timers, no Date.now() inside)
// so the logic can be tested with a fake clock.

export interface ClockState {
  /** Milliseconds accumulated over all finished running periods. */
  accumulatedMs: number;
  /** Timestamp the current running period began, or null while stopped. */
  runStartedAt: number | null;
}

export const INITIAL_CLOCK: ClockState = { accumulatedMs: 0, runStartedAt: null };

/** Start or stop the clock. Idempotent: repeating the same state is a no-op. */
export function setRunning(state: ClockState, running: boolean, now: number): ClockState {
  if (running) {
    return state.runStartedAt === null ? { ...state, runStartedAt: now } : state;
  }
  if (state.runStartedAt === null) return state;
  return {
    accumulatedMs: state.accumulatedMs + Math.max(0, now - state.runStartedAt),
    runStartedAt: null,
  };
}

export function elapsedMs(state: ClockState, now: number): number {
  const live = state.runStartedAt === null ? 0 : Math.max(0, now - state.runStartedAt);
  return state.accumulatedMs + live;
}

export function elapsedSeconds(state: ClockState, now: number): number {
  return Math.floor(elapsedMs(state, now) / 1000);
}
