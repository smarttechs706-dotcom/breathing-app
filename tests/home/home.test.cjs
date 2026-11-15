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

test('spacing: hero behind the header, one flexible gap, cards low with a fixed gap above the tab bar', () => {
  const home = fs.readFileSync(path.join(repo, 'src/features/home/HomeScreen.tsx'), 'utf8');
  assert.ok(home.includes('const GAP_MIN = 16;'));
  assert.ok(home.includes('const CARD_OVERLAP = 40;'));
  assert.ok(home.includes('const BOTTOM_GAP = spacing.base * 3;'));
  assert.ok(home.includes('paddingBottom: bottomSpace + BOTTOM_GAP'));
  assert.ok(/gap: \{\s*flexGrow: 1,\s*\}/.test(home));
  // The hero runs behind the status bar: the top inset is content padding, not a SafeAreaView edge.
  assert.ok(home.includes('paddingTop: insets.top'));
  assert.ok(!home.includes('SafeAreaView'));
  // Order: hero (absolute, behind), header, gap, cards.
  const order = [
    '<HomeHero height={heroH} />',
    '<View onLayout={onHeaderLayout}>',
    '<View style={[styles.gap, { minHeight: gapMin }]} />',
    '<View style={styles.lower}>',
  ];
  let at = -1;
  for (const part of order) {
    const next = home.indexOf(part, at + 1);
    assert.ok(next > at, `${part} out of order`);
    at = next;
  }
  assert.ok(!/HorizonBand|BAND_ASPECT|bottomGap/.test(home));
  // Still scrollable.
  assert.ok(/content: \{\s*flexGrow: 1,\s*\}/.test(home));
});

const hero = loadTs('src/features/home/heroLayout.ts');

test('hero height: about 42% of the screen (383 dp on this phone), clamped 300-440', () => {
  assert.equal(hero.heroHeight(2408 / 2.625), 383);
  assert.equal(hero.heroHeight(640), 300);
  assert.equal(hero.heroHeight(1200), 440);
});

test('hero video: covers the hero completely and keeps the sun in view on 320-480 dp screens', () => {
  for (const w of [320, 360, 393, 411.43, 430, 480]) {
    for (const winH of [640, 760, 917.3, 1000]) {
      const h = hero.heroHeight(winH);
      const f = hero.heroVideoFrame(w, h);
      assert.ok(f.left <= 1e-9 && f.left + f.width >= w - 1e-9, `covers width at ${w}x${winH}`);
      assert.ok(f.top <= 1e-9 && f.top + f.height >= h - 1e-9, `covers height at ${w}x${winH}`);
      const sun = (f.left + hero.SUN_X * f.scale) / w;
      assert.ok(sun >= 0.55 && sun <= 0.85, `sun at ${sun.toFixed(2)} across at ${w}x${winH}`);
    }
  }
  // This phone: 1.96x upscale, 43% of the width visible.
  const f = hero.heroVideoFrame(411.43, 383);
  assert.ok(Math.abs((383 * 2.625) / 512 - 1.96) < 0.01);
  assert.ok(Math.abs(411.43 / f.scale / 1280 - 0.43) < 0.01);
});

test('hero bottom fade is eased: solid at the edge, clear at the inner end; no top fade', () => {
  const { edgeAlpha, ALPHA_OFFSETS, BOTTOM_FADE } = hero;
  assert.equal(hero.TOP_FADE, undefined);
  assert.equal(BOTTOM_FADE, 0.4);
  assert.ok(ALPHA_OFFSETS.length >= 5, 'at least 5 alpha stops');
  assert.equal(edgeAlpha(0), 1);
  assert.ok(Math.abs(edgeAlpha(1)) < 1e-12);
  assert.ok(Math.abs(edgeAlpha(0.5) - 0.5) < 1e-12);
  // Ease-in-out: changes slowly at both ends, fastest in the middle.
  const step = (a, b) => edgeAlpha(a) - edgeAlpha(b);
  assert.ok(step(0, 1 / 6) < step(1 / 3, 1 / 2));
  assert.ok(step(5 / 6, 1) < step(1 / 2, 2 / 3));
  for (let i = 0; i < 6; i++) assert.ok(edgeAlpha(i / 6) > edgeAlpha((i + 1) / 6));
});

test('hero top shade: very light (0.10), eased over at least 5 stops, clear at the horizon', () => {
  const stops = hero.topShadeStops();
  assert.ok(hero.TOP_SHADE <= 0.12);
  assert.ok(stops.length >= 5);
  assert.ok(Math.abs(stops[0].alpha - hero.TOP_SHADE) < 1e-12);
  assert.ok(Math.abs(stops[stops.length - 1].alpha) < 1e-12);
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].alpha < stops[i - 1].alpha);
  // The horizon is 193 dp down on this phone; the shade clears 30 dp below it,
  // so it still reaches the sun (on the horizon) at about half strength.
  const f = hero.heroVideoFrame(411.43, 383);
  assert.ok(Math.abs(hero.horizonOnHero(f) - 193) < 1);
  assert.equal(hero.SHADE_PAST_HORIZON, 30);
  assert.ok(Math.abs(hero.shadeHeight(f) - 223) < 1);
});

test('header over the hero: white greeting and letters, no plates, ring-only empty days, glass pill with white text and a deep red flame', () => {
  const header = fs.readFileSync(path.join(repo, 'src/features/home/PreviewHeader.tsx'), 'utf8');
  const styles = fs.readFileSync(path.join(repo, 'src/features/home/styles.ts'), 'utf8');
  assert.ok(/greeting: \{\s*\.\.\.text\.greeting,\s*color: '#ffffff',\s*\}/.test(header));
  assert.ok(/dayLetter: \{\s*\.\.\.text\.dayLetter,\s*color: '#ffffff',\s*\}/.test(header));
  // The week row has no background at all.
  assert.ok(/days: \{\s*flexDirection: 'row',\s*\}/.test(header));
  assert.ok(!/weekPlateFill|streakPillFill/.test(header + styles));
  assert.ok(styles.includes("dayEmpty: 'transparent',"));
  assert.ok(styles.includes("dayEmptyBorder: 'rgba(255,255,255,0.6)',"));
  assert.ok(styles.includes("streakFlame: '#dc2626',"));
  assert.ok(!styles.includes('streakGold'));
  assert.ok(/streakText: \{\s*\.\.\.text\.streak,\s*color: '#ffffff',\s*\}/.test(header));
  // The pill keeps its original light glass.
  assert.ok(/streakPill: \{[\s\S]*?borderColor: accents\.glassBorder,\s*backgroundColor: accents\.glassFill,\s*\}/.test(header));
  assert.ok(header.includes('<Ionicons name="flame" size={16} color={accents.streakFlame} />'));
  // Font family and weight only ever come from the typography roles.
  assert.ok(!/fontFamily:|fontWeight:/.test(header));
});

// --- Ambient sound (ambientSound.ts) -------------------------------------

const sound = loadTs('src/features/home/ambientSound.ts');

test('ambient fade-in: 0 at the start, the 0.5 target after 2 s, eased, never above the target', () => {
  assert.equal(sound.AMBIENT_TARGET_VOLUME, 0.5);
  assert.equal(sound.FADE_IN_MS, 2000);
  assert.equal(sound.fadeInVolume(0), 0);
  assert.equal(sound.fadeInVolume(-100), 0);
  assert.ok(Math.abs(sound.fadeInVolume(2000) - 0.5) < 1e-12);
  assert.ok(Math.abs(sound.fadeInVolume(9000) - 0.5) < 1e-12);
  assert.ok(Math.abs(sound.fadeInVolume(1000) - 0.25) < 1e-12);
  let prev = -1;
  for (let ms = 0; ms <= 2000; ms += sound.FADE_TICK_MS) {
    const v = sound.fadeInVolume(ms);
    assert.ok(v >= prev && v <= 0.5 + 1e-12, `${ms} ms: ${v}`);
    prev = v;
  }
  // Eased: the first and last steps are gentler than the middle ones.
  const step = (a) => sound.fadeInVolume(a + 100) - sound.fadeInVolume(a);
  assert.ok(step(0) < step(950) && step(1900) < step(950));
  // The target is a parameter, so tuning it is one constant.
  assert.ok(Math.abs(sound.fadeInVolume(2000, 0.3) - 0.3) < 1e-12);
});

// --- Header avatars removed (2026-11-15) -------------------------------------

test('no header avatar on Home, Library or Insights; the picture lives only on Profile', () => {
  assert.ok(!fs.existsSync(path.join(repo, 'src/features/home/PreviewAvatar.tsx')));
  for (const f of ['src/features/home/PreviewHeader.tsx', 'src/features/library/LibraryScreen.tsx', 'src/features/insights/InsightsScreen.tsx']) {
    const src = fs.readFileSync(path.join(repo, f), 'utf8');
    assert.ok(!/PreviewAvatar|AccountAvatar/.test(src), f);
  }
  // The Profile tab is still in the bottom bar, and Profile keeps its tappable circle.
  assert.ok(fs.readFileSync(path.join(repo, 'app/(tabs)/_layout.tsx'), 'utf8').includes('<Tabs.Screen name="profile"'));
  assert.ok(fs.readFileSync(path.join(repo, 'src/features/profile/ProfileScreen.tsx'), 'utf8').includes('onPress={openPhotoChoices}'));
  // The hidden Player tab keeps its AccountAvatar, as decided.
  assert.ok(fs.readFileSync(path.join(repo, 'app/(tabs)/player.tsx'), 'utf8').includes('<AccountAvatar size={40} />'));
});

test('Library and Insights headers: still 64 dp, the title is the only child and a header', () => {
  for (const f of ['src/features/library/LibraryScreen.tsx', 'src/features/insights/InsightsScreen.tsx']) {
    const src = fs.readFileSync(path.join(repo, f), 'utf8');
    assert.ok(/<View style=\{styles\.header\}>\s*<Text style=\{styles\.title\} accessibilityRole="header">/.test(src), f);
    assert.ok(/header: \{[\s\S]*?height: 64,/.test(src), `${f}: height kept`);
  }
});

test('Home greeting row: no circle; greeting, name and the sun or moon icon unchanged', () => {
  const src = fs.readFileSync(path.join(repo, 'src/features/home/PreviewHeader.tsx'), 'utf8');
  assert.ok(src.includes('<Text style={styles.greeting}>{greetingForHour(hour)}</Text>'));
  assert.ok(src.includes('<Text style={styles.name} numberOfLines={1}>'));
  assert.ok(src.includes("name={evening ? 'moon' : 'sunny'}"));
  assert.ok(!/const AVATAR\b/.test(src));
  // Same 24 dp margin as the week row.
  assert.ok(/greetingRow: \{[\s\S]*?paddingHorizontal: spacing\.marginMobile,/.test(src));
  assert.ok(/weekRow: \{[\s\S]*?paddingHorizontal: spacing\.marginMobile,/.test(src));
});
