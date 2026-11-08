// Tests for the Home screen's pure logic (src/features/home). Run with:
//   node --test tests/home/home.test.cjs
// Reuses the auth tests' TypeScript loader; it is not part of `npm run test:auth`.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const { greetingForHour, backgroundPhaseForHour } = loadTs('src/features/home/timeOfDay.ts');
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

test('background boundaries: night 21-05, morning 05-12, afternoon 12-17, evening 17-21', () => {
  const expected = {
    0: 'night',
    4: 'night',
    5: 'morning',
    11: 'morning',
    12: 'afternoon',
    16: 'afternoon',
    17: 'evening',
    20: 'evening',
    21: 'night',
    23: 'night',
  };
  for (const [hour, phase] of Object.entries(expected)) {
    assert.equal(backgroundPhaseForHour(Number(hour)), phase, `hour ${hour}`);
  }
});

test('out-of-range hours wrap instead of falling into the wrong branch', () => {
  assert.equal(greetingForHour(24), 'Good night');
  assert.equal(greetingForHour(-1), 'Good evening');
  assert.equal(backgroundPhaseForHour(29), 'morning');
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

// --- Ambient motion (ambient.ts) ------------------------------------------

const ambient = loadTs('src/features/home/ambient.ts');

// The test phone: 1080x2408 px at 2.75 px/dp.
const PHONE = { w: 1080 / 2.75, h: 2408 / 2.75 };
const ON_SCREEN = 0.44;
// Every painting: [width, height, shoreline row].
const PAINTINGS = {
  morning: [853, 1844, 925],
  afternoon: [853, 1844, 925],
  evening: [852, 1846, 925 * (1846 / 1844)],
  night: [852, 1846, 961],
};

function frameFor([iw, ih, row]) {
  const horizon = row / ih;
  const frame = ambient.paintingFrame(iw, ih, PHONE.w, PHONE.h, horizon, ON_SCREEN);
  return { frame, horizonY: frame.top + frame.height * horizon };
}

test('each painting, including night with its own shoreline, puts the horizon at 44%', () => {
  for (const [name, painting] of Object.entries(PAINTINGS)) {
    const { horizonY } = frameFor(painting);
    assert.ok(Math.abs(horizonY / PHONE.h - ON_SCREEN) < 0.001, `${name}: ${horizonY / PHONE.h}`);
  }
});

test('drift never zooms below 1.06 and stays slow', () => {
  assert.ok(ambient.DRIFT_MIN_SCALE >= 1.06);
  assert.ok(ambient.DRIFT_MAX_SCALE > ambient.DRIFT_MIN_SCALE);
  const loopMs = 2 * ambient.DRIFT_HALF_MS;
  assert.ok(loopMs >= 40_000 && loopMs <= 60_000, `loop ${loopMs} ms`);
});

test('drift keeps the horizon on the same row at every scale (within 0.01 dp)', () => {
  for (const [name, painting] of Object.entries(PAINTINGS)) {
    const { frame, horizonY } = frameFor(painting);
    for (const s of [ambient.DRIFT_MIN_SCALE, 1.07, ambient.DRIFT_MAX_SCALE]) {
      const edges = ambient.driftEdges(frame, horizonY, s, 0);
      assert.ok(Math.abs(edges.horizon - horizonY) < 0.01, `${name} at ${s}: ${edges.horizon} vs ${horizonY}`);
    }
  }
});

test('drift never reveals an edge or more of the bottom strip, at any scale and shift', () => {
  for (const [name, painting] of Object.entries(PAINTINGS)) {
    const { frame, horizonY } = frameFor(painting);
    const stillBottom = frame.top + frame.height;
    for (const s of [ambient.DRIFT_MIN_SCALE, ambient.DRIFT_MAX_SCALE]) {
      for (const shift of [-ambient.DRIFT_SHIFT_X, ambient.DRIFT_SHIFT_X]) {
        const e = ambient.driftEdges(frame, horizonY, s, shift);
        assert.ok(e.left <= 0, `${name} left ${e.left}`);
        assert.ok(e.right >= PHONE.w, `${name} right ${e.right}`);
        assert.ok(e.top <= 0, `${name} top ${e.top}`);
        assert.ok(e.bottom >= stillBottom, `${name} bottom ${e.bottom} < ${stillBottom}`);
      }
    }
  }
});

test('twinkle stars: the right count, the same every time, only in the side bands of sky', () => {
  const stars = ambient.twinkleStars();
  assert.ok(stars.length >= 12 && stars.length <= 16);
  assert.deepEqual(ambient.twinkleStars(), stars);
  const { left, right, y } = ambient.STAR_BANDS;
  for (const s of stars) {
    const inLeft = s.x >= left[0] && s.x <= left[1];
    const inRight = s.x >= right[0] && s.x <= right[1];
    assert.ok(inLeft || inRight, `x ${s.x}`);
    // Never over the orb's glow (centre half of the screen) or the text rows.
    assert.ok(s.x < 0.24 || s.x > 0.76, `x ${s.x}`);
    assert.ok(s.y >= y[0] && s.y <= y[1], `y ${s.y}`);
    assert.ok(s.y < ON_SCREEN, 'above the horizon');
    assert.ok(s.size >= 1.5 && s.size <= 2, `size ${s.size}`);
    assert.ok(s.phase >= 0 && s.phase < 1);
    // Clear of the night moon (about 28-40% across, 19-26% down).
    const inMoon = s.x >= 0.28 && s.x <= 0.4 && s.y >= 0.19 && s.y <= 0.26;
    assert.ok(!inMoon, `star in the moon area at ${s.x}, ${s.y}`);
  }
  // Different phases, so they don't all blink together.
  assert.ok(new Set(stars.map((s) => s.phase.toFixed(3))).size === stars.length);
});

test('twinkle stars are small and soft: 1.5-2 dp, peak opacity about 0.6', () => {
  assert.equal(ambient.STAR_MIN_SIZE, 1.5);
  assert.equal(ambient.STAR_MAX_SIZE, 2);
  assert.ok(ambient.TWINKLE_HIGH <= 0.6 + 1e-9);
  assert.ok(ambient.TWINKLE_LOW < ambient.TWINKLE_HIGH);
});

test('neither side band of stars forms a line, and no two stars crowd together', () => {
  const stars = ambient.twinkleStars();
  const corr = (pts) => {
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (const p of pts) {
      sxy += (p.x - mx) * (p.y - my);
      sxx += (p.x - mx) ** 2;
      syy += (p.y - my) ** 2;
    }
    return sxy / Math.sqrt(sxx * syy);
  };
  for (const band of [stars.filter((s) => s.x < 0.5), stars.filter((s) => s.x >= 0.5)]) {
    assert.ok(Math.abs(corr(band)) < 0.3, `x-y correlation ${corr(band)}`);
    for (let i = 0; i < band.length; i++) {
      for (let j = i + 1; j < band.length; j++) {
        const dx = (band[i].x - band[j].x) * PHONE.w;
        const dy = (band[i].y - band[j].y) * PHONE.h;
        assert.ok(Math.hypot(dx, dy) >= 12, `stars ${Math.hypot(dx, dy).toFixed(1)} dp apart`);
      }
    }
  }
});

test('twinkle curve stays between low and high and loops without a jump', () => {
  for (const phase of [0, 0.3, 0.75]) {
    const { inputRange, outputRange } = ambient.twinkleCurve(phase);
    assert.equal(inputRange[0], 0);
    assert.equal(inputRange[inputRange.length - 1], 1);
    for (let i = 1; i < inputRange.length; i++) assert.ok(inputRange[i] > inputRange[i - 1]);
    for (const v of outputRange) {
      assert.ok(v >= ambient.TWINKLE_LOW - 1e-9 && v <= ambient.TWINKLE_HIGH + 1e-9);
    }
    assert.ok(Math.abs(outputRange[0] - outputRange[outputRange.length - 1]) < 1e-9);
  }
});

test('water shimmer is faint and sits between the horizon and the Featured card', () => {
  assert.ok(ambient.SHIMMER_PEAK_OPACITY <= 0.12);
  assert.ok(ambient.SHIMMER_OFFSET > 0);
  // The card stays at least 40 dp below the horizon (HomeScreen CARD_BELOW_HORIZON).
  assert.ok(ambient.SHIMMER_OFFSET + ambient.SHIMMER_HEIGHT < 40);
  assert.ok(ambient.SHIMMER_LOOP_MS >= 10_000);
});
