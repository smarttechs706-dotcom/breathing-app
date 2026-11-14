// Pure rules for a session's breathing pattern: the small label shown on cards
// ("4-7-8"), the plain line on the pre-session screen ("Breathe in 4, hold 7,
// breathe out 8"), and how long a session really runs so it ends on a whole
// breath. No React Native imports, so it is tested directly in Node
// (tests/session/breathPattern.test.cjs).
//
// Everything here reads the same phaseConfig object that drives the timer and
// BreathCircle, so the text on screen can never disagree with the animation.

export interface BreathPattern {
  inhale: number;
  hold: number;
  exhale: number;
  rest: number; // the hold after the out-breath
}

// Negative or non-finite phases count as 0.
function sec(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Seconds as shown to people: whole numbers as they are, otherwise one decimal.
function num(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : String(Math.round(seconds * 10) / 10);
}

// "4-7-8" (in, hold, out); two numbers ("5-5", "4-8") when there is no hold;
// all four ("4-4-4-4") when the rest after the out-breath is used. Hyphens only.
export function patternLabel(p: BreathPattern): string {
  if (sec(p.rest) > 0) return [p.inhale, p.hold, p.exhale, p.rest].map((n) => num(sec(n))).join('-');
  if (sec(p.hold) > 0) return [p.inhale, p.hold, p.exhale].map((n) => num(sec(n))).join('-');
  return [p.inhale, p.exhale].map((n) => num(sec(n))).join('-');
}

// "Breathe in 4, hold 7, breathe out 8". Any 0-second phase is left out; the
// rest after the out-breath is added at the end as ", hold N".
export function patternLine(p: BreathPattern): string {
  const parts: string[] = [];
  if (sec(p.inhale) > 0) parts.push(`breathe in ${num(p.inhale)}`);
  if (sec(p.hold) > 0) parts.push(`hold ${num(p.hold)}`);
  if (sec(p.exhale) > 0) parts.push(`breathe out ${num(p.exhale)}`);
  if (sec(p.rest) > 0) parts.push(`hold ${num(p.rest)}`);
  const line = parts.join(', ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

// One full breath: in + hold + out + rest, in seconds.
export function cycleSeconds(p: BreathPattern): number {
  return sec(p.inhale) + sec(p.hold) + sec(p.exhale) + sec(p.rest);
}

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest';

export interface BreathState {
  phase: BreathPhase;
  // Counts phases from the start (0, 1, 2...): changes exactly when the phase
  // changes, so it can key an animation.
  step: number;
  phaseElapsedMs: number;
  phaseDurationMs: number;
}

const ORDER: BreathPhase[] = ['inhale', 'hold', 'exhale', 'rest'];

// The phases that actually happen, in order: any 0-second phase is skipped,
// so a 0-second hold never appears, not even for a moment.
function steps(p: BreathPattern): { phase: BreathPhase; ms: number }[] {
  return ORDER.map((phase) => ({ phase, ms: sec(p[phase]) * 1000 })).filter((s) => s.ms > 0);
}

// Where the breath is `elapsedMs` into the session. The one clock that drives
// the phase word, the instruction line and the circle reads this.
export function breathAt(p: BreathPattern, elapsedMs: number): BreathState {
  const list = steps(p);
  if (list.length === 0) return { phase: 'inhale', step: 0, phaseElapsedMs: 0, phaseDurationMs: 0 };
  const cycleMs = list.reduce((t, s) => t + s.ms, 0);
  const ms = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const cycle = Math.floor(ms / cycleMs);
  let into = ms - cycle * cycleMs;
  for (let i = 0; i < list.length; i++) {
    if (into < list[i].ms) {
      return { phase: list[i].phase, step: cycle * list.length + i, phaseElapsedMs: into, phaseDurationMs: list[i].ms };
    }
    into -= list[i].ms;
  }
  // Floating-point edge: exactly at the cycle end, which is the next inhale.
  return { phase: list[0].phase, step: (cycle + 1) * list.length, phaseElapsedMs: 0, phaseDurationMs: list[0].ms };
}

// When the screen next needs to update after `elapsedMs`: the next phase
// change, the next whole second (for the timer text) or the end, whichever
// comes first. Never earlier than 1 ms ahead.
export function nextTickMs(p: BreathPattern, elapsedMs: number, endMs: number): number {
  const b = breathAt(p, elapsedMs);
  const phaseEnd = elapsedMs - b.phaseElapsedMs + b.phaseDurationMs;
  const nextSecond = (Math.floor(elapsedMs / 1000) + 1) * 1000;
  const candidates = [nextSecond, endMs].concat(b.phaseDurationMs > 0 ? [phaseEnd] : []);
  return Math.max(elapsedMs + 1, Math.min(...candidates.filter((t) => t > elapsedMs)));
}

// How long a session with this pattern really runs for a chosen length: the
// length rounded down to a whole number of breaths (at least one), ending at
// the end of the last out-breath (a final rest after it is not waited out).
// It is never longer than the chosen length when that fits at least one breath.
// 0 for an empty pattern (the API already rejects those).
export function sessionSeconds(p: BreathPattern, lengthSec: number): number {
  const cycle = cycleSeconds(p);
  if (cycle <= 0) return 0;
  const length = Number.isFinite(lengthSec) && lengthSec > 0 ? lengthSec : 0;
  const breaths = Math.max(1, Math.floor(length / cycle));
  return breaths * cycle - sec(p.rest);
}
