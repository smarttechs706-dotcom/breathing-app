// The 7-day activity row: Sunday to Saturday of the current week, in the
// phone's local time. A day is "done" only if a real check-in's createdAt
// falls on it. Nothing here guesses or fills in days.
//
// Known mismatch, not fixed here: the server counts streak days in UTC, this
// row counts local days. Near midnight the two can disagree.

export interface ActivityDay {
  key: string; // local date, YYYY-MM-DD
  letter: string;
  done: boolean;
  isToday: boolean;
  isFuture: boolean;
}

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function localDateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function dayName(index: number): string {
  return DAY_NAMES[index] ?? '';
}

export function weekActivity(checkinDates: readonly string[], now: Date): ActivityDay[] {
  const doneKeys = new Set<string>();
  for (const iso of checkinDates) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) doneKeys.add(localDateKey(date));
  }

  const todayKey = localDateKey(now);
  // Built from calendar fields, not by adding 24h, so a DST change can't skip
  // or repeat a day.
  return LETTERS.map((letter, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + i);
    const key = localDateKey(day);
    return {
      key,
      letter,
      done: doneKeys.has(key),
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });
}

// What a screen reader hears for the week row. The circles show this calendar
// week by local day; the count is the server's sessionsThisWeek, which is a
// rolling 7 days, so it is named that way rather than "this week".
export function weekSummary(days: readonly ActivityDay[], sessionsLast7Days: number): string {
  const n = Math.max(0, Math.floor(sessionsLast7Days));
  const perDay = days.map((d, i) => `${dayName(i)} ${d.done ? 'done' : 'no session'}`).join(', ');
  const count = n === 1 ? '1 session in the last 7 days' : `${n} sessions in the last 7 days`;
  return `This week: ${perDay}. ${count}.`;
}

export function streakLabel(days: number): string {
  const n = Math.max(0, Math.floor(days));
  return n === 1 ? '1 day' : `${n} days`;
}

export function formatMinutes(durationSec: number): string {
  return `${Math.round(durationSec / 60)} min`;
}
