// Tests for the Insights tab's computations (src/features/insights). Run with:
//   node --test tests/insights/insights.test.cjs
// Reuses the auth tests' TypeScript loader; not part of `npm run test:auth`.
// Run with TZ=Asia/Dubai to check the UTC+4 local-day rule (the npm-less
// command below sets it); the day tests build their own local dates otherwise.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const week = loadTs('src/features/home/weekActivity.ts');
const m = loadTs('src/features/insights/insightsModel.ts', {
  stubs: { '../home/weekActivity': { localDateKey: week.localDateKey } },
});
const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');

const c = (pre, post, createdAt) => ({ preMood: pre, postMood: post, createdAt });

test('calm shift: signed one-decimal average of after minus before', () => {
  const s = m.calmShift([c(2, 4, '2026-11-08T08:00:00Z'), c(3, 3, '2026-11-09T08:00:00Z'), c(1, 2, '2026-11-10T08:00:00Z')]);
  assert.equal(s.count, 3);
  assert.equal(s.value, 1); // (2 + 0 + 1) / 3
  assert.equal(s.label, '+1.0');
  assert.equal(s.fill, 0.25);
});

test('calm shift: ring fills 0 to +4 and clamps; zero or negative leaves it empty but keeps the number', () => {
  assert.equal(m.calmShift([c(1, 5, '2026-11-10T08:00:00Z')]).fill, 1);
  const zero = m.calmShift([c(3, 3, '2026-11-10T08:00:00Z')]);
  assert.equal(zero.fill, 0);
  assert.equal(zero.label, '0.0');
  const neg = m.calmShift([c(4, 3, '2026-11-10T08:00:00Z'), c(4, 4, '2026-11-10T09:00:00Z')]);
  assert.equal(neg.fill, 0);
  assert.equal(neg.label, '-0.5');
  assert.ok(!/[–—]/.test(neg.label), 'no long or en dash');
});

test('calm shift: no check-ins means no number at all (nothing invented)', () => {
  assert.deepEqual(m.calmShift([]), { count: 0, value: null, label: '', fill: 0 });
});

test('calm shift: one check-in is shown and counted as one', () => {
  const s = m.calmShift([c(2, 3, '2026-11-08T08:00:00Z')]);
  assert.equal(s.count, 1);
  assert.equal(s.label, '+1.0');
});

test('this week runs Sunday to Saturday in local time, like Home', () => {
  const now = new Date(2026, 10, 10, 15, 0); // Tue 10 Nov 2026, local
  const days = m.thisWeek(now);
  assert.deepEqual(days.map((d) => d.label), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.equal(days[0].key, '2026-11-08');
  assert.equal(days[2].isToday, true);
  assert.equal(days[3].isFuture, true);
});

test('a check-in lands on its LOCAL day, not its UTC date', () => {
  const now = new Date(2026, 10, 10, 15, 0);
  // Local 01:30 on Mon 9 Nov, written the way the server sends it (UTC).
  const localLateNight = new Date(2026, 10, 9, 1, 30);
  const dots = m.weekDots([c(2, 3, localLateNight.toISOString())], now);
  assert.deepEqual(dots.map((d) => d.done), [false, true, false, false, false, false, false]);
});

test('in Dubai (UTC+4), 21:30 UTC counts on the NEXT local day', { skip: new Date(2026, 0, 1).getTimezoneOffset() !== -240 }, () => {
  const now = new Date(2026, 10, 10, 15, 0);
  const dots = m.weekDots([c(2, 3, '2026-11-08T21:30:00Z')], now); // = Mon 9 Nov 01:30 Dubai
  assert.equal(dots[1].done, true);
  assert.equal(dots[0].done, false);
});

test('mood journey: averages per local day, null where there is no check-in', () => {
  const now = new Date(2026, 10, 10, 15, 0);
  const mon = new Date(2026, 10, 9, 9, 0).toISOString();
  const mon2 = new Date(2026, 10, 9, 18, 0).toISOString();
  const days = m.moodJourney([c(2, 4, mon), c(3, 4, mon2)], now);
  assert.equal(days[1].before, 2.5);
  assert.equal(days[1].after, 4);
  assert.equal(days[1].count, 2);
  for (const i of [0, 2, 3, 4, 5, 6]) {
    assert.equal(days[i].before, null);
    assert.equal(days[i].after, null);
  }
});

test('check-ins outside this week are not drawn; bad rows are ignored, never NaN', () => {
  const now = new Date(2026, 10, 10, 15, 0);
  const lastWeek = new Date(2026, 10, 3, 9, 0).toISOString();
  const days = m.moodJourney([c(2, 4, lastWeek), c(Number.NaN, 4, now.toISOString()), c(2, 4, 'not a date')], now);
  assert.ok(days.every((d) => d.before === null && d.after === null));
  assert.equal(m.calmShift([c(Number.NaN, 4, now.toISOString())]).count, 0);
});

test('labels: days, sessions and minutes', () => {
  assert.equal(m.dayCount(1), '1 day');
  assert.equal(m.dayCount(3), '3 days');
  assert.equal(m.sessionCount(1), '1 session');
  assert.equal(m.minutesValue(42), '42');
  assert.equal(m.minutesValue(65), '1h 5m');
  assert.equal(m.minutesValue(120), '2h');
  assert.equal(m.minutesValue(-3), '0');
});

test('screen: no light blue, white spinner, copy without long dashes, totals left out', () => {
  const files = [
    'src/features/insights/InsightsScreen.tsx',
    'src/features/insights/CalmShiftRing.tsx',
    'src/features/insights/MoodJourneyChart.tsx',
    'src/features/insights/insightColors.ts',
  ];
  for (const f of files) {
    const src = read(f);
    assert.ok(!/colors\.primary\b|#b9c3ff/i.test(src), `${f}: no light blue`);
    assert.ok(!/[–—]/.test(src), `${f}: no long or en dash`);
    assert.ok(!/fontFamily:|fontWeight:/.test(src), `${f}: no direct font settings`);
  }
  const screen = read('src/features/insights/InsightsScreen.tsx');
  assert.ok(screen.includes('<ActivityIndicator color={INSIGHT_COLORS.emphasis} />'));
  // Tiles: short label with a sub-label underneath.
  assert.ok(/>\s*Mindful minutes\s*</.test(screen) && screen.includes('>all time<'));
  assert.ok(screen.includes('>Sessions<') && screen.includes('>last 7 days<'));
  assert.ok(screen.includes('Best: {dayCount(insights.streak.longestStreak)}'));
  assert.ok(!/totalSessions|monthOverMonthDelta/.test(screen));
  // Page title from the shared pageTitle size (24/32).
  assert.ok(screen.includes('...text.pageTitle'));
});

test('chart: Before is a larger slate ring drawn under the white After dot, so equal points both show', () => {
  // Normalised so the check works whether git checked the file out with LF or CRLF.
  const src = read('src/features/insights/MoodJourneyChart.tsx').replace(/\r\n/g, '\n');
  const ring = src.indexOf('stroke={INSIGHT_COLORS.before}\n                  strokeWidth');
  const dot = src.indexOf('fill={INSIGHT_COLORS.emphasis} />');
  assert.ok(/r=\{7\}[\s\S]*?fill="none"[\s\S]*?stroke=\{INSIGHT_COLORS\.before\}/.test(src));
  assert.ok(src.includes('r={4.5} fill={INSIGHT_COLORS.emphasis}'));
  assert.ok(ring > -1 && dot > ring, 'Before ring is drawn before the After dot');
});

test('Library and Insights page titles use the shared 24 sp pageTitle (Fraunces, 36 line height)', () => {
  const styles = read('src/features/home/styles.ts');
  assert.ok(styles.includes('pageTitle: { ...typography.displayTitle, fontSize: 24, lineHeight: 36 }'));
  assert.ok(read('src/features/library/LibraryScreen.tsx').includes('...text.pageTitle'));
});

test('the tab keeps its data loading, error and retry exactly as before', () => {
  const src = read('app/(tabs)/insights.tsx');
  for (const must of [
    'const [insights, setInsights] = useState<InsightsResponse | null>(null);',
    'const [error, setError] = useState<string | null>(null);',
    '.catch((err) => setError(friendlyError(err)));',
    'useRefreshOnNewCheckin(refreshAfterCheckin);',
    'onRetry={load}',
  ]) assert.ok(src.includes(must), must);
});
