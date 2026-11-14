// Tests for the Home screen's pure logic (src/features/home). Run with:
//   node --test tests/home/home.test.cjs
// Reuses the auth tests' TypeScript loader; it is not part of `npm run test:auth`.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const fs = require('node:fs');
const path = require('node:path');

const { greetingForHour } = loadTs('src/features/home/timeOfDay.ts');
const repo = path.join(__dirname, '..', '..');
const { weekActivity, weekSummary, streakLabel, formatMinutes, localDateKey } = loadTs(
  'src/features/home/weekActivity.ts'
);
const { pickFeatured, pickNowForYou, NOW_FOR_YOU_IDS } = loadTs('src/features/home/picks.ts');

test('greeting boundaries: night 00-05, morning 05-12, afternoon 12-17, evening 17-24', () => {
  const expected = {
    0: 'Good night',
    1: 'Good night',
    4: 'Good night',
    5: 'Good morning',
    11: 'Good morning',
    12: 'Good afternoon',
    16: 'Good afternoon',
    17: 'Good evening',
    20: 'Good evening',
    21: 'Good evening',
    23: 'Good evening',
  };
  for (const [hour, greeting] of Object.entries(expected)) {
    assert.equal(greetingForHour(Number(hour)), greeting, `hour ${hour}`);
  }
});

test('after midnight is "Good night", never "Good evening"', () => {
  assert.equal(greetingForHour(23), 'Good evening');
  assert.equal(greetingForHour(0), 'Good night');
});

test('out-of-range hours wrap instead of falling into the wrong branch', () => {
  assert.equal(greetingForHour(24), 'Good night');
  assert.equal(greetingForHour(-1), 'Good evening');
  assert.equal(greetingForHour(29), 'Good morning');
});

// All dates below use the local-time Date constructor, so the test passes in
// any time zone.
const THURSDAY = new Date(2026, 10, 12, 9, 0); // Thu 12 Nov 2026, 09:00 local

test('the row is Sunday to Saturday of the current local week', () => {
  const days = weekActivity([], THURSDAY);
  assert.deepEqual(
    days.map((d) => d.letter),
    ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  );
  assert.equal(days[0].key, '2026-11-08');
  assert.equal(days[6].key, '2026-11-14');
  assert.deepEqual(
    days.map((d) => d.isToday),
    [false, false, false, false, true, false, false]
  );
  assert.deepEqual(
    days.map((d) => d.isFuture),
    [false, false, false, false, false, true, true]
  );
});

test('a new user with no check-ins has no done days', () => {
  assert.ok(weekActivity([], THURSDAY).every((d) => !d.done));
});

test('only days with a real check-in are done, counted by local day', () => {
  const checkins = [
    new Date(2026, 10, 9, 0, 10).toISOString(), // Mon just after midnight
    new Date(2026, 10, 9, 22, 0).toISOString(), // Mon again, counts once
    new Date(2026, 10, 11, 23, 59).toISOString(), // Wed just before midnight
    new Date(2026, 10, 7, 12, 0).toISOString(), // last Saturday, outside this week
  ];
  const days = weekActivity(checkins, THURSDAY);
  assert.deepEqual(
    days.map((d) => d.done),
    [false, true, false, true, false, false, false]
  );
});

test('unparseable dates are ignored, not counted', () => {
  const days = weekActivity(['not a date', ''], THURSDAY);
  assert.ok(days.every((d) => !d.done));
});

test('on a Sunday the week starts today; on a Saturday it ends today', () => {
  const sunday = weekActivity([], new Date(2026, 10, 8, 0, 30));
  assert.equal(sunday[0].key, '2026-11-08');
  assert.equal(sunday[0].isToday, true);
  const saturday = weekActivity([], new Date(2026, 10, 14, 23, 30));
  assert.equal(saturday[6].key, '2026-11-14');
  assert.equal(saturday[6].isToday, true);
});

test('a week across a month boundary keeps real dates', () => {
  const days = weekActivity([], new Date(2026, 11, 2, 12, 0)); // Wed 2 Dec
  assert.equal(days[0].key, '2026-11-29');
  assert.equal(days[6].key, '2026-12-05');
});

test('localDateKey pads month and day', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('screen readers hear each day and the server count, named as the last 7 days', () => {
  const checkins = [new Date(2026, 10, 9, 10, 0).toISOString()]; // Monday
  const days = weekActivity(checkins, THURSDAY);
  assert.equal(
    weekSummary(days, 3),
    'This week: Sunday no session, Monday done, Tuesday no session, Wednesday no session, ' +
      'Thursday no session, Friday no session, Saturday no session. 3 sessions in the last 7 days.'
  );
  assert.match(weekSummary(days, 1), /\. 1 session in the last 7 days\.$/);
  assert.match(weekSummary(weekActivity([], THURSDAY), 0), /\. 0 sessions in the last 7 days\.$/);
  assert.match(weekSummary(days, -2), /\. 0 sessions in the last 7 days\.$/);
});

test('streak label shows the real count, including 0', () => {
  assert.equal(streakLabel(0), '0 days');
  assert.equal(streakLabel(1), '1 day');
  assert.equal(streakLabel(12), '12 days');
  assert.equal(streakLabel(-3), '0 days');
});

test('durations are whole minutes', () => {
  assert.equal(formatMinutes(600), '10 min');
  assert.equal(formatMinutes(18 * 60), '18 min');
});

const session = (id, title = id) => ({ id, title, durationSec: 600, category: 'Calm' });

test('featured is deep-exhale, else the first session, else nothing', () => {
  assert.equal(pickFeatured([session('a'), session('deep-exhale')]).id, 'deep-exhale');
  assert.equal(pickFeatured([session('a'), session('b')]).id, 'a');
  assert.equal(pickFeatured([]), null);
});

test('"Now for you" uses the three real ids, in order, and skips missing ones', () => {
  assert.deepEqual([...NOW_FOR_YOU_IDS], ['morning-reset', 'calm-focus', 'stress-relief']);
  const all = [
    session('stress-relief'),
    session('deep-exhale'),
    session('calm-focus'),
    session('morning-reset'),
  ];
  assert.deepEqual(
    pickNowForYou(all).map((s) => s.id),
    ['morning-reset', 'calm-focus', 'stress-relief']
  );
  assert.deepEqual(
    pickNowForYou([session('calm-focus')]).map((s) => s.id),
    ['calm-focus']
  );
  assert.deepEqual(pickNowForYou([]), []);
});

// --- Backdrop -------------------------------------------------------------

test('Home uses the shared mist backdrop; the time-of-day scenes and the orb are gone', () => {
  const home = fs.readFileSync(path.join(repo, 'src/features/home/HomeScreen.tsx'), 'utf8');
  assert.ok(home.includes('<ScreenBackdrop painting={MIST_BACKGROUND} />'));
  assert.ok(!/TimeOfDayBackground|PreviewOrb|backgroundPhaseForHour|SCENES/.test(home));
  for (const gone of [
    'src/features/home/TimeOfDayBackground.tsx',
    'src/features/home/backgrounds.ts',
    'src/features/home/AmbientLayers.tsx',
    'src/features/home/ambient.ts',
    'src/features/home/PreviewOrb.tsx',
    'src/features/home/images/home-morning.jpg',
    'src/features/home/images/home-afternoon.jpg',
    'src/features/home/images/home-evening.jpg',
    'src/features/home/images/home-night.jpg',
    'src/components/BreathOrb.tsx',
    'assets/illustrations/hero-orb.png',
  ]) {
    assert.ok(!fs.existsSync(path.join(repo, gone)), `${gone} still exists`);
  }
  // The Featured card's own thumbnail stays.
  assert.ok(fs.existsSync(path.join(repo, 'src/features/home/images/deep-exhale.jpg')));
});

test('the horizon band space is full width at 2.5 : 1 (164 dp on a 411 dp phone)', () => {
  const home = fs.readFileSync(path.join(repo, 'src/features/home/HomeScreen.tsx'), 'utf8');
  assert.ok(home.includes('const BAND_ASPECT = 2.5;'));
  assert.equal(Math.round(411 / 2.5), 164);
});
