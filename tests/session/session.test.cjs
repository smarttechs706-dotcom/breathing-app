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

test('moods 1-5: five emoji faces in order from stressed to calm, values unchanged', () => {
  assert.deepEqual(model.MOOD_LEVELS.map((l) => l.value), [1, 2, 3, 4, 5]);
  assert.deepEqual(model.MOOD_LEVELS.map((l) => l.emoji), ['\u{1F623}', '\u{1F61F}', '\u{1F610}', '\u{1F642}', '\u{1F60C}']);
  assert.deepEqual(model.MOOD_LEVELS.map((l) => l.word), ['Stressed', 'Uneasy', 'Okay', 'Relaxed', 'Calm']);
});

test('no mood chosen yet gives no level; out-of-range values clamp', () => {
  assert.equal(model.moodLevel(null), null);
  assert.equal(model.moodLevel(NaN), null);
  assert.equal(model.moodLevel(0).word, 'Stressed');
  assert.equal(model.moodLevel(9).word, 'Calm');
  assert.equal(model.moodLevel(3).emoji, '\u{1F610}');
});

test('mood scale: only the two end labels on screen, the full word for screen readers, values 1-5', () => {
  const src = fs.readFileSync(path.join(repo, 'src/features/session/MoodScale.tsx'), 'utf8');
  // Visible words: exactly "Stressed" and "Calm" at the ends, nothing for the middle three.
  const visible = [...src.matchAll(/<Text style=\{styles\.label\}>([^<]*)<\/Text>/g)].map((m) => m[1]);
  assert.deepEqual(visible, ['Stressed', 'Calm']);
  assert.ok(!/Uneasy|Okay|Relaxed/.test(src.replace(/\/\/.*$/gm, '')), 'no middle words in the component');
  // Each button reads its word; the emoji itself is not read aloud.
  assert.ok(src.includes('accessibilityLabel={`${level.word}, ${level.value} of ${MOOD_LEVELS.length}`}'));
  assert.ok(src.includes('<Text style={styles.emoji} accessible={false} importantForAccessibility="no">'));
  // Stored values unchanged.
  assert.ok(src.includes('onPress={() => onChange(level.value)}'));
  // No weather icons any more.
  assert.ok(!/Ionicons|MOOD_ICONS|moodIcon\(/.test(src));
});

test('mood caption: the chosen word under the scale after a tap; its line is reserved so nothing moves', () => {
  const src = fs.readFileSync(path.join(repo, 'src/features/session/MoodScale.tsx'), 'utf8');
  assert.ok(src.includes('const chosen = moodLevel(value);'));
  assert.ok(/<Text\s+style=\{styles\.caption\}\s+accessibilityLiveRegion="polite"/.test(src));
  assert.ok(src.includes("{chosen?.word ?? ''}"));
  assert.ok(src.includes("importantForAccessibility={chosen === null ? 'no-hide-descendants' : 'auto'}"));
  // Nothing animates (reduced motion has nothing to turn off).
  assert.ok(!/Animated|useReducedMotion/.test(src));
});

test('Session Complete Before -> After: the same emoji with its word; a plain hyphen when none', () => {
  const src = fs.readFileSync(path.join(repo, 'src/features/session/MoodScale.tsx'), 'utf8');
  const glyph = src.slice(src.indexOf('export function MoodGlyph'));
  assert.ok(glyph.includes('accessibilityLabel={level.word}'));
  assert.ok(glyph.includes('accessibilityLabel="No mood chosen"'));
  assert.ok(/>\s*-\s*<\/Text>/.test(glyph), 'plain hyphen placeholder');
  assert.ok(!/[–—]/.test(src), 'no long dashes in the component');
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

test('phase strengths: portrait 80% before, none while breathing (video + 55% scrim), 70% after', () => {
  assert.equal(model.portraitOpacity('pre-mood'), 0.8);
  assert.equal(model.portraitOpacity('active'), 0);
  assert.equal(model.portraitOpacity('post-mood'), 0.7);
  assert.equal(model.BREATHING_SCRIM, 0.55);
  for (const id of SESSION_IDS) {
    assert.deepEqual(model.backdropLayers('pre-mood', id), { portrait: 0.8, video: false, scrim: 0 });
    assert.deepEqual(model.backdropLayers('active', id), { portrait: 0, video: true, scrim: 0.55 });
    assert.deepEqual(model.backdropLayers('post-mood', id), { portrait: 0.7, video: false, scrim: 0 });
  }
});

test('loading and error screens (no session yet) are plain navy: no picture, no video', () => {
  for (const phase of ['pre-mood', 'active', 'post-mood']) {
    assert.deepEqual(model.backdropLayers(phase, null), { portrait: 0, video: false, scrim: 0 });
  }
  // A session without a portrait still gets the video while breathing.
  assert.deepEqual(model.backdropLayers('pre-mood', 'some-new-session'), { portrait: 0, video: false, scrim: 0 });
  assert.deepEqual(model.backdropLayers('active', 'some-new-session'), { portrait: 0, video: true, scrim: 0.55 });
});

test('a custom session borrows Calm and Focus: same file, opacities and fades, no new image', () => {
  assert.deepEqual(model.BORROWED_PORTRAITS, { custom: 'calm-focus' });
  assert.equal(model.portraitSessionId('custom'), 'calm-focus');
  assert.equal(model.portraitSessionId('calm-focus'), 'calm-focus');
  assert.equal(model.portraitSessionId(null), null);
  assert.equal(model.hasSessionPortrait('custom'), true);
  // Exactly the layers Calm and Focus gets in every phase (80%, video + 55%, 70%).
  for (const phase of ['pre-mood', 'active', 'post-mood']) {
    assert.deepEqual(model.backdropLayers(phase, 'custom'), model.backdropLayers(phase, 'calm-focus'), phase);
  }
  // Still no file of its own: the images folder holds only the six built-in portraits.
  assert.ok(!('custom' in model.SESSION_PORTRAIT_FILES));
  const images = fs.readdirSync(path.join(repo, 'src/features/session/images')).filter((f) => f.endsWith('-portrait.jpg'));
  assert.deepEqual(images.sort(), Object.values(model.SESSION_PORTRAIT_FILES).sort());
  // The backdrop picks the image through the same lookup, with the same fades.
  const backdrop = fs.readFileSync(path.join(repo, 'src/features/session/SessionBackdrop.tsx'), 'utf8');
  assert.ok(backdrop.includes('const portraitId = portraitSessionId(sessionId);'));
  assert.ok(backdrop.includes('const portraitImage = portraitId ? SESSION_PORTRAITS[portraitId] : undefined;'));
  assert.ok(backdrop.includes('const layers = backdropLayers(phase, sessionId);'));
  assert.ok(backdrop.includes('const portraitOpacity = useOpacityTo(layers.portrait, reduced);'));
});

test('all six sessions have their own portrait, every file exists, and the two maps agree', () => {
  const files = new Set();
  for (const id of SESSION_IDS) assert.ok(model.hasSessionPortrait(id), id);
  assert.equal(model.hasSessionPortrait('some-new-session'), false);
  assert.equal(model.hasSessionPortrait(null), false);
  const imagesSource = fs.readFileSync(path.join(repo, 'src/features/session/sessionImages.ts'), 'utf8');
  for (const [id, file] of Object.entries(model.SESSION_PORTRAIT_FILES)) {
    assert.ok(fs.existsSync(path.join(repo, 'src/features/session/images', file)), `missing ${file}`);
    assert.ok(imagesSource.includes(`'${id}': require('./images/${file}')`), `sessionImages.ts lacks portrait ${id}`);
    files.add(file);
  }
  assert.equal(files.size, 6, 'a different picture per session');
  // The six landscape paintings stay deleted.
  for (const id of SESSION_IDS) {
    assert.ok(!fs.existsSync(path.join(repo, 'src/features/session/images', `session-${id}.jpg`)), `session-${id}.jpg is back`);
  }
  assert.ok(!/SESSION_IMAGES\b/.test(imagesSource));
});

test('backdrop: the video only while breathing, one source, crossfade 400 ms, instant with reduced motion', () => {
  const backdrop = fs.readFileSync(path.join(repo, 'src/features/session/SessionBackdrop.tsx'), 'utf8');
  const sources = backdrop.match(/require\('[^']+\.mp4'\)/g) || [];
  assert.deepEqual(sources, ["require('../../../assets/videos/breathing-background-loop.mp4')"]);
  assert.equal((backdrop.match(/<LoopingVideo /g) || []).length, 1);
  assert.ok(backdrop.includes('{videoMounted && ('));
  assert.ok(backdrop.includes('useVideoMounted(layers.video, reduced)'));
  assert.ok(backdrop.includes('const DIM_MS = 400;'));
  assert.ok(/if \(reduced !== false\) \{\s*value\.setValue\(target\);/.test(backdrop), 'instant with reduced motion');
  assert.ok(backdrop.includes('backgroundColor: `rgba(10,16,40,${BREATHING_SCRIM})`'));
});

test('one clock: the player derives phase, circle and end from breathed time; no second timer', () => {
  const player = fs.readFileSync(path.join(repo, 'app/session-player.tsx'), 'utf8');
  assert.ok(player.includes('const breath = breathAt(session.phaseConfig, elapsedMs);'));
  // The end follows the length chosen before the session (2, 3, 5 or 10 min).
  assert.ok(player.includes('sessionSeconds(session.phaseConfig, lengthSec) * 1000'));
  assert.ok(player.includes('nextTickMs(session.phaseConfig, ms, endMs)'));
  assert.ok(player.includes('if (phase === \'active\' && elapsedMs >= endMs) {'));
  // The old per-phase timer chain is gone.
  assert.ok(!/breathSubPhase|BreathSubPhase|setInterval\(/.test(player));
  // The circle follows the clock and stops whenever the clock stops.
  assert.ok(/<BreathCircle[\s\S]*?phase=\{breath\.phase\}[\s\S]*?step=\{breath\.step\}[\s\S]*?paused=\{!running\}/.test(player));
  // Mindful minutes come from the seconds actually breathed.
  assert.ok(player.includes('{breathedMinutes} Mindful Minutes'));
  assert.ok(player.includes('Math.round(Math.min(elapsedMs, endMs) / 60000)'));
  assert.ok(!player.includes('Math.round(session.durationSec / 60)} Mindful Minutes'));
});

test('BreathCircle: no clock of its own, and its look is byte-for-byte unchanged', () => {
  const { execFileSync } = require('node:child_process');
  const now = fs.readFileSync(path.join(repo, 'src/features/session/BreathCircle.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const before = execFileSync('git', ['show', '72d4f19:src/features/session/BreathCircle.tsx'], { cwd: repo })
    .toString().replace(/\r\n/g, '\n');
  assert.ok(!/Animated\.(loop|sequence|delay)/.test(now), 'no own loop');
  // Colours, sizes and the breath scale.
  const constants = (t) => t.slice(t.indexOf('export const CIRCLE_COLORS'), t.indexOf('// "BREATHE IN"'));
  assert.equal(constants(now), constants(before));
  // Everything drawn, and all styles.
  const drawn = (t) => t.slice(t.indexOf('  const centre = SIZE * CENTRE;'));
  assert.equal(drawn(now), drawn(before));
});
