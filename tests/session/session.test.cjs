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

test('painting is full before, about 35% while breathing, about 80% after', () => {
  assert.equal(model.paintingOpacity('pre-mood'), 1);
  assert.equal(model.paintingOpacity('active'), 0.35);
  assert.equal(model.paintingOpacity('post-mood'), 0.8);
});

test('painting is 1.8:1 and content starts 60% of the way down it', () => {
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

test('all six sessions have a painting, every file exists, and the two maps agree', () => {
  for (const id of SESSION_IDS) assert.ok(model.hasSessionImage(id), id);
  const imagesSource = fs.readFileSync(path.join(repo, 'src/features/session/sessionImages.ts'), 'utf8');
  for (const [id, file] of Object.entries(model.SESSION_IMAGE_FILES)) {
    assert.ok(fs.existsSync(path.join(repo, 'src/features/session/images', file)), `missing ${file}`);
    assert.ok(imagesSource.includes(`'${id}': require('./images/${file}')`), `sessionImages.ts lacks ${id}`);
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

test('a session without a painting (or no session yet) gets the plain navy background', () => {
  assert.equal(model.hasSessionImage('some-new-session'), false);
  assert.equal(model.hasSessionImage(null), false);
});

test('with a portrait, it shows on every phase: 80% before, 45% breathing, 70% after; no top painting', () => {
  assert.deepEqual(model.backdropOpacities('pre-mood', true), { top: 0, portrait: 0.8 });
  assert.deepEqual(model.backdropOpacities('active', true), { top: 0, portrait: 0.45 });
  assert.deepEqual(model.backdropOpacities('post-mood', true), { top: 0, portrait: 0.7 });
});

test('without a portrait, the top painting is the fallback (100% / 35% / 80%)', () => {
  assert.deepEqual(model.backdropOpacities('pre-mood', false), { top: 1, portrait: 0 });
  assert.deepEqual(model.backdropOpacities('active', false), { top: 0.35, portrait: 0 });
  assert.deepEqual(model.backdropOpacities('post-mood', false), { top: 0.8, portrait: 0 });
});

test('all six sessions have a portrait, every file exists, and the two maps agree', () => {
  for (const id of SESSION_IDS) assert.ok(model.hasSessionPortrait(id), id);
  assert.equal(model.hasSessionPortrait('some-new-session'), false);
  assert.equal(model.hasSessionPortrait(null), false);
  const imagesSource = fs.readFileSync(path.join(repo, 'src/features/session/sessionImages.ts'), 'utf8');
  for (const [id, file] of Object.entries(model.SESSION_PORTRAIT_FILES)) {
    assert.ok(fs.existsSync(path.join(repo, 'src/features/session/images', file)), `missing ${file}`);
    assert.ok(imagesSource.includes(`'${id}': require('./images/${file}')`), `sessionImages.ts lacks portrait ${id}`);
  }
});
