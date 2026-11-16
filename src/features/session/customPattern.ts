// Pure rules for session lengths and the "Create your own" pattern: the length
// choices, the limits per phase, reading a pattern from the player's link
// parameters, the in-memory custom session, the editor's screen reader wording,
// and the seconds a check-in reports. No React Native imports, so it is tested
// directly in Node (tests/session/customPattern.test.cjs).
//
// Approved 2026-11-16: lengths 2, 3, 5 and 10 minutes for every session;
// breathe in 2-10 s, hold 0-10 s, breathe out 2-12 s, rest 0-10 s, one breath
// at most 30 s, default 4-0-6-0; minutes count what was actually played. Only
// the last custom pattern is remembered, one per account on this phone
// (lastPattern.ts); there is no list of saved patterns.

import type { Session } from '../../types/models';
import { cycleSeconds, patternLabel, patternLine, sessionSeconds, type BreathPattern } from './breathPattern';

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
// A custom session's fixed length before it starts: "Session length, 5 minutes".
export function lengthLabelSpoken(sec: number): string {
  return `Session length, ${lengthSpoken(sec)}`;
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

// --- Playing a custom session -----------------------------------------------

export const CUSTOM_TITLE = 'Your pattern';
export const CUSTOM_DESCRIPTION = 'A pattern you set yourself.';

// A pattern and its length: what is remembered as the last custom pattern.
export interface Recipe {
  pattern: BreathPattern;
  lengthSec: LengthSec;
}

// The player's link for a custom session: /session-player?sessionId=custom&pattern=4-7-8-0&length=300
export function customPlayerHref(p: BreathPattern, lengthSec: LengthSec): string {
  return `/session-player?sessionId=${CUSTOM_SESSION_ID}&pattern=${formatPatternParam(p)}&length=${lengthSec}`;
}

// The "Create your own" editor (it opens with the last custom pattern).
export const EDITOR_HREF = '/create-pattern';

// The in-memory session the player plays for a custom pattern, or null when
// the link's pattern or length is not valid (the player then shows "Session
// not found"). The id is the hidden catalogue row the check-in is saved under.
export function customSession(rawPattern: unknown, rawLength: unknown): Session | null {
  const phaseConfig = parsePatternParam(rawPattern);
  const lengthSec = parseLengthParam(rawLength);
  if (!phaseConfig || !lengthSec) return null;
  return {
    id: CUSTOM_SESSION_ID,
    title: CUSTOM_TITLE,
    category: 'Calm',
    durationSec: lengthSec,
    phaseConfig,
    badge: 'Leaf',
    pattern: 'rings',
    description: CUSTOM_DESCRIPTION,
  };
}

// --- Editor wording -------------------------------------------------------------

export const PHASE_NAMES: Record<PhaseName, string> = {
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
  rest: 'Rest',
};

export const SAFETY_NOTE =
  "Long holds aren't for everyone. If you feel dizzy or short of breath, stop and breathe normally.";

function seconds(n: number): string {
  return `${n} ${n === 1 ? 'second' : 'seconds'}`;
}

// Stepper: "Breathe in, 4 seconds".
export function stepperSpoken(phase: PhaseName, value: number): string {
  return `${PHASE_NAMES[phase]}, ${seconds(value)}`;
}

// The live label: "Pattern 4-7-8: breathe in 4, hold 7, breathe out 8".
export function patternSpoken(p: BreathPattern): string {
  const line = patternLine(p);
  return `Pattern ${patternLabel(p)}: ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
}

// Start button: "Start · 5 min" on screen, "Start, 5 minute session, pattern 4-7-8" spoken.
export function startText(lengthSec: number): string {
  return `Start · ${lengthLabel(lengthSec)}`;
}
export function startSpoken(p: BreathPattern, lengthSec: number): string {
  return `Start, ${Math.round(lengthSec / 60)} minute session, pattern ${patternLabel(p)}`;
}
