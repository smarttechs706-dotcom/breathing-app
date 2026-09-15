// Dummy/placeholder data per CLAUDE.md's build order — real values arrive
// once breathing-app-api's GET /api/insights exists (architecture.md's API
// contract: checkins, streak, totalSessions, sessionsThisWeek,
// mindfulMinutes, monthOverMonthDelta). Numbers below match
// insights-screenshot.png exactly (5 / 48 / 12h / +12%) rather than being
// invented separately, and streak/sessionsThisWeek reuse Home's existing
// dummy values (5-day streak, 12 sessions) for narrative consistency
// across screens.

export interface MoodPoint {
  /** ISO date (yyyy-mm-dd) */
  date: string;
  /** 1 (stressed) - 5 (calm) */
  mood: number;
}

// insights-code.html's own mood-trend line is a literal hardcoded demo
// squiggle (`M0 150 Q 50 120...`), not derived from real data — since our
// version needs to render from actual mood values (so the chart is
// meaningful once real checkins exist), this is a plausible wave of
// 1-5 mood scores across the last 30 days rather than a copy of that
// arbitrary demo path.
export const moodTrend: MoodPoint[] = [
  { date: '2026-08-14', mood: 2 },
  { date: '2026-08-17', mood: 3 },
  { date: '2026-08-20', mood: 3 },
  { date: '2026-08-23', mood: 2 },
  { date: '2026-08-26', mood: 4 },
  { date: '2026-08-29', mood: 3 },
  { date: '2026-09-01', mood: 3 },
  { date: '2026-09-04', mood: 5 },
  { date: '2026-09-07', mood: 3 },
  { date: '2026-09-10', mood: 4 },
];

export const streak = {
  currentStreak: 5,
  longestStreak: 8,
};

export const totalSessions = 48;
export const sessionsThisWeek = 12;
// insights-screenshot.png shows "12h" — 720 raw minutes so the display
// formatting (see insights.tsx) naturally produces that.
export const mindfulMinutes = 720;
export const monthOverMonthDelta = 12; // percent, matches "+12%"

// "Consistency" calendar: 4 weeks x 7 days = 28 cells, true = session
// completed that day. Fixed (not random-per-render) so it doesn't change
// on every reload; roughly matches the reference screenshot's ~70% fill
// proportion.
export const consistencyCalendar: boolean[] = [
  false, true, true, true, true, true, false,
  false, false, false, true, true, true, true,
  true, true, true, true, true, false, true,
  true, false, false, true, true, false, true,
];
