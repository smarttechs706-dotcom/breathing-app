// Pure rules for session lengths and the "Create your own" pattern: the length
// choices, the limits per phase, reading a pattern from the player's link
// parameters, and the seconds a check-in reports. No React Native imports, so
// it is tested directly in Node (tests/session/customPattern.test.cjs).
//
// Approved 2026-11-16: lengths 2, 3, 5 and 10 minutes for every session;
// breathe in 2-10 s, hold 0-10 s, breathe out 2-12 s, rest 0-10 s, one breath
// at most 30 s, default 4-0-6-0; minutes count what was actually played.

import { cycleSeconds, sessionSeconds, type BreathPattern } from './breathPattern';

export const LENGTH_OPTIONS = [120, 180, 300, 600] as const;
export type LengthSec = (typeof LENGTH_OPTIONS)[number];
export const DEFAULT_LENGTH_SEC: LengthSec = 300;

export type PhaseName = keyof BreathPattern;
export const PHASES: PhaseName[] = ['inhale', 'hold', 'exhale', 'rest'];

export const PHASE_LIMITS: Record<PhaseName, { min: number; max: number }> = {
  inhale: { min: 2, max: 10 },
  hold: { min: 0, max: 10 },
  exhale: { min: 2, max: 12 },
  rest: { min: 0, max: 10 },
};

// One full breath (in + hold + out + rest), at most.
export const MAX_BREATH_SEC = 30;

export const DEFAULT_CUSTOM_PATTERN: BreathPattern = { inhale: 4, hold: 0, exhale: 6, rest: 0 };

// The hidden catalogue row a custom session's check-in is recorded under.
export const CUSTOM_SESSION_ID = 'custom';

// The API accepts durationSec as a whole number from 60 to 600.
const MIN_CHECKIN_SEC = 60;
const MAX_CHECKIN_SEC = 600;

export function isLengthOption(n: unknown): n is LengthSec {
  return typeof n === 'number' && (LENGTH_OPTIONS as readonly number[]).includes(n);
}

// A built-in session's own length if it is one of the choices (300 or 180
// today), otherwise 5 minutes.
export function defaultLengthFor(durationSec: number): LengthSec {
  return isLengthOption(durationSec) ? durationSec : DEFAULT_LENGTH_SEC;
}

// "5 min" on screen; "5 minutes" for screen readers.
export function lengthLabel(sec: number): string {
  return `${Math.round(sec / 60)} min`;
}
export function lengthSpoken(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
}

function inLimits(phase: PhaseName, n: unknown): boolean {
  const { min, max } = PHASE_LIMITS[phase];
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

// Whole seconds, every phase inside its limits, one breath at most 30 s.
export function isValidCustomPattern(p: unknown): p is BreathPattern {
  if (!p || typeof p !== 'object') return false;
  const v = p as Record<string, unknown>;
  if (!PHASES.every((phase) => inLimits(phase, v[phase]))) return false;
  return cycleSeconds(v as unknown as BreathPattern) <= MAX_BREATH_SEC;
}

// The pattern with one phase moved by `delta` seconds, or null when that would
// leave the limits or make one breath longer than 30 s (the stepper button is
// then disabled).
export function stepPhase(p: BreathPattern, phase: PhaseName, delta: number): BreathPattern | null {
  const next = { ...p, [phase]: p[phase] + delta };
  return isValidCustomPattern(next) ? next : null;
}

// "4-7-8-0": the four phases in order, for the player's link parameters.
export function formatPatternParam(p: BreathPattern): string {
  return PHASES.map((phase) => p[phase]).join('-');
}

// Reads "4-7-8-0" back. Exactly four whole numbers, inside the limits;
// anything else (a typed or broken link) is null.
export function parsePatternParam(raw: unknown): BreathPattern | null {
  if (typeof raw !== 'string' || !/^\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2}$/.test(raw)) return null;
  const [inhale, hold, exhale, rest] = raw.split('-').map(Number);
  const p = { inhale, hold, exhale, rest };
  return isValidCustomPattern(p) ? p : null;
}

// "300" -> 300, only for one of the length choices.
export function parseLengthParam(raw: unknown): LengthSec | null {
  if (typeof raw !== 'string' || !/^\d{3}$/.test(raw)) return null;
  const n = Number(raw);
  return isLengthOption(n) ? n : null;
}

// The seconds a completed session actually played (whole breaths, see
// sessionSeconds), as the check-in's durationSec. Undefined when it falls
// outside what the API accepts, so the check-in still saves (the server then
// counts the catalogue length, as before).
export function checkinDurationSec(p: BreathPattern, lengthSec: number): number | undefined {
  const played = Math.round(sessionSeconds(p, lengthSec));
  return played >= MIN_CHECKIN_SEC && played <= MAX_CHECKIN_SEC ? played : undefined;
}
