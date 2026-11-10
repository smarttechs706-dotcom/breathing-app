// Pure computations for the Insights tab (InsightsScreen.tsx). No React
// Native, so they are tested directly in Node (tests/insights/insights.test.cjs).
// Everything comes from GET /api/insights as it is; nothing is invented. Days
// are the phone's local days (check-ins arrive as UTC timestamps), the same
// rule as Home's week row. The streak itself is the server's number, counted
// in UTC days, so near local midnight the two can disagree; it is shown as is.

import { localDateKey } from '../home/weekActivity';

// The fields used here (src/types/models.ts Checkin).
export interface InsightCheckin {
  preMood: number; // 1-5
  postMood: number; // 1-5
  createdAt: string; // ISO timestamp, UTC
}

// Moods run 1-5, so a shift runs -4 to +4. The ring shows 0 to +4.
export const MAX_SHIFT = 4;

export interface CalmShift {
  count: number; // check-ins it is based on
  value: number | null; // average postMood - preMood, one decimal; null with no check-ins
  label: string; // "+1.2", "0.0", "-0.5"; "" with no check-ins
  fill: number; // 0..1 ring fill: value / MAX_SHIFT, clamped; 0 for zero or negative
}

function isMood(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function usable(c: InsightCheckin): boolean {
  return isMood(c.preMood) && isMood(c.postMood) && !Number.isNaN(new Date(c.createdAt).getTime());
}

function roundOne(n: number): number {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

export function signedLabel(value: number): string {
  if (value > 0) return `+${value.toFixed(1)}`;
  if (value < 0) return `-${Math.abs(value).toFixed(1)}`;
  return '0.0';
}

// Average change in mood per session across the returned check-ins (the
// server sends the last 30 days).
export function calmShift(checkins: readonly InsightCheckin[]): CalmShift {
  const list = checkins.filter(usable);
  if (list.length === 0) return { count: 0, value: null, label: '', fill: 0 };
  const sum = list.reduce((acc, c) => acc + (c.postMood - c.preMood), 0);
  const value = roundOne(sum / list.length);
  return {
    count: list.length,
    value,
    label: signedLabel(value),
    fill: Math.min(1, Math.max(0, value / MAX_SHIFT)),
  };
}

export interface WeekDay {
  key: string; // local date YYYY-MM-DD
  label: string; // "Sun" .. "Sat"
  isToday: boolean;
  isFuture: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// This calendar week, Sunday to Saturday, in local time (same as Home). Built
// from calendar fields, not by adding 24h, so a DST change cannot skip a day.
export function thisWeek(now: Date): WeekDay[] {
  const todayKey = localDateKey(now);
  return DAY_LABELS.map((label, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + i);
    const key = localDateKey(day);
    return { key, label, isToday: key === todayKey, isFuture: key > todayKey };
  });
}

export interface JourneyDay extends WeekDay {
  before: number | null; // average preMood that day, or null with no check-in
  after: number | null; // average postMood that day, or null with no check-in
  count: number;
}

// Before and after moods per local day of this week. Days without a check-in
// stay null (the chart leaves a gap; nothing is filled in).
export function moodJourney(checkins: readonly InsightCheckin[], now: Date): JourneyDay[] {
  const byDay = new Map<string, { pre: number; post: number; n: number }>();
  for (const c of checkins) {
    if (!usable(c)) continue;
    const key = localDateKey(new Date(c.createdAt));
    const acc = byDay.get(key) ?? { pre: 0, post: 0, n: 0 };
    acc.pre += c.preMood;
    acc.post += c.postMood;
    acc.n += 1;
    byDay.set(key, acc);
  }
  return thisWeek(now).map((day) => {
    const acc = byDay.get(day.key);
    return {
      ...day,
      before: acc ? roundOne(acc.pre / acc.n) : null,
      after: acc ? roundOne(acc.post / acc.n) : null,
      count: acc ? acc.n : 0,
    };
  });
}

// The consistency dots: a day is done only if a real check-in falls on it.
export function weekDots(checkins: readonly InsightCheckin[], now: Date): (WeekDay & { done: boolean })[] {
  const done = new Set(checkins.filter(usable).map((c) => localDateKey(new Date(c.createdAt))));
  return thisWeek(now).map((day) => ({ ...day, done: done.has(day.key) }));
}

function plural(n: number, one: string, many: string): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return `${v} ${v === 1 ? one : many}`;
}

export const dayCount = (n: number) => plural(n, 'day', 'days');
export const sessionCount = (n: number) => plural(n, 'session', 'sessions');

// "42" under 60, "1h 5m" / "2h" above.
export function minutesValue(minutes: number): string {
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  if (m < 60) return `${m}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}
