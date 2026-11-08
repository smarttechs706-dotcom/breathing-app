// Tests for the Library tab's pure logic (src/features/library). Run with:
//   node --test tests/library/library.test.cjs
// Reuses the auth tests' TypeScript loader; it is not part of `npm run test:auth`.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const lib = loadTs('src/features/library/libraryModel.ts');
const repo = path.join(__dirname, '..', '..');

// The real catalog (architecture.md's locked table + durations).
const s = (id, title, category, minutes, badge) => ({ id, title, category, durationSec: minutes * 60, badge });
const CATALOG = [
  s('deep-exhale', 'Deep Exhale', 'Calm', 10, 'Leaf'),
  s('morning-reset', 'Morning Reset', 'Energy', 18, 'Zap'),
  s('calm-focus', 'Calm and Focus', 'Calm', 15, 'Leaf'),
  s('stress-relief', 'Stress Relief', 'Calm', 10, 'Leaf'),
  s('wind-down', 'Sleep Wind Down', 'Sleep', 12, 'Moon'),
  s('box-breathing', 'Box Breathing', 'Recovery', 12, 'Heart'),
];

test('the five chips and their real counts', () => {
  assert.deepEqual([...lib.CATEGORIES], ['For You', 'Calm', 'Sleep', 'Energy', 'Recovery']);
  const counts = lib.CATEGORIES.map((c) => lib.countFor(CATALOG, c));
  assert.deepEqual(counts, [6, 3, 1, 1, 1]);
  assert.equal(lib.countFor(null, 'Calm'), 0);
});

test('filters by category, then by a trimmed, case-insensitive title search', () => {
  const ids = (list) => list.map((x) => x.id);
  assert.deepEqual(ids(lib.filterSessions(CATALOG, 'For You', '')), ids(CATALOG));
  assert.deepEqual(ids(lib.filterSessions(CATALOG, 'Sleep', '')), ['wind-down']);
  assert.deepEqual(ids(lib.filterSessions(CATALOG, 'For You', '  BOX ')), ['box-breathing']);
  assert.deepEqual(ids(lib.filterSessions(CATALOG, 'Calm', 'focus')), ['calm-focus']);
  assert.deepEqual(lib.filterSessions(CATALOG, 'Energy', 'calm'), []);
  assert.deepEqual(lib.filterSessions(null, 'For You', ''), []);
});

test('Quick Start is Deep Exhale, else the first session, else nothing', () => {
  assert.equal(lib.quickStartTarget(CATALOG).id, 'deep-exhale');
  assert.equal(lib.quickStartTarget(CATALOG.slice(1)).id, 'morning-reset');
  assert.equal(lib.quickStartTarget([]), null);
  assert.equal(lib.quickStartTarget(null), null);
});

test('durations read as whole minutes', () => {
  assert.equal(lib.formatDuration(600), '10 min');
  assert.equal(lib.formatDuration(18 * 60), '18 min');
});

test('every badge has an outline icon from the existing badge map', () => {
  assert.deepEqual(lib.BADGE_ICON, {
    Leaf: 'leaf-outline',
    Moon: 'moon-outline',
    Zap: 'flash-outline',
    Heart: 'heart-outline',
  });
});

test('all six real sessions have a card image, every image file exists, and the two maps agree', () => {
  for (const session of CATALOG) assert.ok(lib.hasCardImage(session.id), session.id);
  const imagesSource = fs.readFileSync(path.join(repo, 'src/features/library/libraryImages.ts'), 'utf8');
  for (const [id, file] of Object.entries(lib.CARD_IMAGE_FILES)) {
    assert.ok(fs.existsSync(path.join(repo, 'src/features/library/images', file)), `missing ${file}`);
    assert.ok(imagesSource.includes(`'${id}': require('./images/${file}')`), `libraryImages.ts lacks ${id}`);
  }
});

test('a session without an image gets the fallback (no other session\'s picture)', () => {
  assert.equal(lib.hasCardImage('some-new-session'), false);
});
