// Tests for the session player's painted background and mood icons
// (src/features/session). Run with:
//   node --test tests/session/session.test.cjs
// Reuses the auth tests' TypeScript loader; it is not part of `npm run test:auth`.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const model = loadTs('src/features/session/sessionModel.ts');
const repo = path.join(__dirname, '..', '..');
const SESSION_IDS = ['deep-exhale', 'morning-reset', 'calm-focus', 'stress-relief', 'wind-down', 'box-breathing'];

test('the top spacer keeps the old 1.8:1 area and content starts 60% of the way down it', () => {
  // This phone: 392.7 dp wide, 36 dp top inset.
  assert.equal(Math.round(model.paintingHeight(392.7)), 218);
  assert.equal(model.contentSpacer(392.7, 36), 31);
  // A very small or tall-inset screen never gets a negative spacer.
  assert.equal(model.contentSpacer(320, 120), 0);
});

test('moods 1-5 map to storm, rain, cloud, part sun, sun', () => {
  const outline = [1, 2, 3, 4, 5].map((m) => model.moodIcon(m, 'outline'));
  const filled = [1, 2, 3, 4, 5].map((m) => model.moodIcon(m, 'filled'));
  assert.deepEqual(outline, ['thunderstorm-outline', 'rainy-outline', 'cloud-outline', 'partly-sunny-outline', 'sunny-outline']);
  assert.deepEqual(filled, ['thunderstorm', 'rainy', 'cloud', 'partly-sunny', 'sunny']);
});

test('no mood chosen yet shows no icon; out-of-range values clamp', () => {
  assert.equal(model.moodIcon(null, 'outline'), null);
  assert.equal(model.moodIcon(0, 'outline'), 'thunderstorm-outline');
  assert.equal(model.moodIcon(9, 'filled'), 'sunny');
});

test('every mood icon exists in the bundled Ionicons font', () => {
  const glyphs = require(path.join(repo, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'));
  for (const icon of model.MOOD_ICONS) {
    assert.ok(icon.outline in glyphs, icon.outline);
    assert.ok(icon.filled in glyphs, icon.filled);
  }
});

test('breathing circle: phase word only (no logo), Animated only, same 1 -> 1.15 breath, reduced motion holds still', () => {
  const src = fs.readFileSync(path.join(repo, 'src/features/session/BreathCircle.tsx'), 'utf8');
  assert.ok(!/waves|Ionicons|MaterialIcons/.test(src), 'no icon inside the circle');
  assert.ok(!/from '(react-native-reanimated|moti|@shopify\/react-native-skia)'/.test(src), 'Animated only');
  assert.ok(src.includes('const BREATH_SCALE = 1.15;'));
  assert.ok(/reduced !== false/.test(src), 'reduced motion handled');
  assert.ok(src.includes('export const CIRCLE_COLORS'), 'colours in one constant');
  const player = fs.readFileSync(path.join(repo, 'app/session-player.tsx'), 'utf8');
  assert.ok(player.includes('<BreathCircle'), 'player uses the new circle');
  assert.ok(!player.includes('BreathingRing'), 'old ring no longer used');
  assert.ok(fs.existsSync(path.join(repo, 'src/components/BreathingRing.tsx')), 'old ring stays in the repo');
});

test('the per-session paintings are gone: no images, no maps, no Image in the backdrop', () => {
  const dir = path.join(repo, 'src/features/session/images');
  for (const id of SESSION_IDS) {
    for (const file of [`session-${id}.jpg`, `session-${id}-portrait.jpg`]) {
      assert.ok(!fs.existsSync(path.join(dir, file)), `${file} still exists`);
    }
  }
  assert.ok(!fs.existsSync(path.join(repo, 'src/features/session/sessionImages.ts')));
  for (const name of ['SESSION_IMAGE_FILES', 'SESSION_PORTRAIT_FILES', 'hasSessionImage', 'backdropOpacities']) {
    assert.equal(model[name], undefined, name);
  }
  const backdrop = fs.readFileSync(path.join(repo, 'src/features/session/SessionBackdrop.tsx'), 'utf8');
  assert.ok(!/\bImage\b|sessionImages|SESSION_IMAGES|SESSION_PORTRAITS/.test(backdrop));
});
