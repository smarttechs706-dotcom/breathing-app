// Tests for the Voice guidance setting (step 3): the store on this phone
// (src/state/audioSettings.ts) and its row in Settings (app/settings.tsx).
// Run with:
//   node --test tests/session/audioSettings.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
const bp = loadTs('src/features/session/breathPattern.ts');
const vs = loadTs('src/features/session/audio/voiceScript.ts');
const fit = loadTs('src/features/session/audio/fitRule.ts');
const sch = loadTs('src/features/session/audio/schedule.ts', {
  stubs: { '../breathPattern': bp, './fitRule': fit, './voiceScript': vs },
});

function storage({ failGet = false, failSet = false, failRemove = false } = {}) {
  const data = new Map();
  return {
    data,
    // An ES module's default export, as `import AsyncStorage from ...` expects.
    __esModule: true,
    default: {
      async getItem(k) {
        if (failGet) throw new Error('read failed');
        return data.has(k) ? data.get(k) : null;
      },
      async setItem(k, v) {
        if (failSet) throw new Error('write failed');
        data.set(k, v);
      },
      async removeItem(k) {
        if (failRemove) throw new Error('remove failed');
        data.delete(k);
      },
    },
  };
}

function load(store) {
  return loadTs('src/state/audioSettings.ts', {
    stubs: { '@react-native-async-storage/async-storage': store, '../features/session/audio/schedule': sch },
  });
}

// --- Store ------------------------------------------------------------------------

test('store: on by default; one key on this phone', async () => {
  const st = storage();
  const as = load(st);
  assert.equal(as.AUDIO_SETTINGS_KEY, 'breathe_audio_settings_v1');
  assert.deepEqual(await as.getAudioSettings(), { voice: true });
  // The stub really is the storage (a save lands in it), so "on" above is the
  // default, not a swallowed error.
  assert.equal(await as.saveAudioSettings({ voice: true }), true);
  assert.equal(st.data.size, 1);
  assert.deepEqual(sch.DEFAULT_AUDIO_SETTINGS, { voice: true });
});

test('store: off is saved and read back; on again too', async () => {
  const st = storage();
  const as = load(st);
  assert.equal(await as.saveAudioSettings({ voice: false }), true);
  assert.equal(st.data.get('breathe_audio_settings_v1'), '{"voice":false}');
  assert.deepEqual(await as.getAudioSettings(), { voice: false });
  await as.saveAudioSettings({ voice: true, extra: 1 });
  assert.equal(st.data.get('breathe_audio_settings_v1'), '{"voice":true}', 'only the voice field is kept');
  assert.deepEqual(await as.getAudioSettings(), { voice: true });
});

test('store: a broken or unexpected stored value falls back to the default (on)', async () => {
  const as = load(storage());
  for (const raw of [null, '', 'not json', '[]', 'null', '42', '{"voice":"off"}', '{"voice":0}', '{}', '{"tones":false}']) {
    assert.deepEqual(as.parseAudioSettings(raw), { voice: true }, String(raw));
  }
  assert.deepEqual(as.parseAudioSettings('{"voice":false,"old":"x"}'), { voice: false });
});

test('store: never throws; a failed save reports false', async () => {
  assert.deepEqual(await load(storage({ failGet: true })).getAudioSettings(), { voice: true });
  assert.equal(await load(storage({ failSet: true })).saveAudioSettings({ voice: false }), false);
  await load(storage({ failRemove: true })).clearAudioSettings();
});

test('store: Delete account clears it (back to on); sign-out keeps it', async () => {
  const st = storage();
  const as = load(st);
  await as.saveAudioSettings({ voice: false });
  await as.clearAudioSettings();
  assert.equal(st.data.has('breathe_audio_settings_v1'), false);
  assert.deepEqual(await as.getAudioSettings(), { voice: true });
  assert.ok(read('src/utils/deleteMyData.ts').includes('    clearAudioSettings,\n'));
  for (const f of ['app/settings.tsx', 'src/auth/AuthProvider.tsx']) {
    const src = read(f);
    const signOut = f === 'app/settings.tsx' ? src.slice(src.indexOf('const handleSignOut'), src.indexOf('async function handleDeleteAccount')) : src;
    assert.ok(!signOut.includes('clearAudioSettings'), `${f}: sign-out keeps the setting`);
  }
});

// --- Settings row ----------------------------------------------------------------

test('Settings: one "Voice guidance" row, a switch for screen readers with its state and hint', () => {
  const src = read('app/settings.tsx');
  assert.ok(src.includes("const VOICE_GUIDANCE_LABEL = 'Voice guidance';"));
  assert.ok(src.includes("const VOICE_GUIDANCE_HELP = 'A calm voice guides each breath, so your eyes can stay closed.';"));
  const row = src.slice(src.indexOf('onPress={toggleVoice}') - 30, src.indexOf('<PillSwitch value={voiceOn} />') + 40);
  assert.ok(row.includes('accessibilityRole="switch"'));
  assert.ok(row.includes('accessibilityLabel={VOICE_GUIDANCE_LABEL}'));
  assert.ok(row.includes('accessibilityHint={VOICE_GUIDANCE_HELP}'));
  assert.ok(row.includes('accessibilityState={{ checked: voiceOn, disabled: audio === null }}'));
  assert.ok(row.includes('<Text style={styles.rowLabelText}>{VOICE_GUIDANCE_LABEL}</Text>'));
  assert.ok(row.includes('<Text style={styles.rowHelp}>{VOICE_GUIDANCE_HELP}</Text>'));
  assert.equal((src.match(/onPress=\{toggleVoice\}/g) || []).length, 1, 'one row');
  // Reads the saved value first (no flip), saves on tap, goes back if not saved.
  assert.ok(src.includes('getAudioSettings().then((s) => {'));
  assert.ok(src.includes('if (!(await saveAudioSettings(next))) setAudio(previous);'));
  // Only the on/off switch: no tones or frequency options.
  assert.ok(!/Tones|first 3|voiceFrequency/i.test(src));
});

test('Settings: its own card, after the account card and before Delete account', () => {
  const src = read('app/settings.tsx');
  const cards = src.split('<PreviewGlass radius={CARD_RADIUS}>').slice(1);
  assert.equal(cards.length, 4);
  assert.ok(cards[0].includes("router.push('/change-password')"));
  assert.ok(cards[1].includes('onPress={toggleVoice}') && !cards[1].includes('handleDeleteAccount'));
  assert.ok(cards[2].includes('onPress={handleDeleteAccount}'));
});

test('Settings: text roles and 8-pt spacing tokens only; the switch is drawn, not a second target', () => {
  const src = read('app/settings.tsx');
  const style = (name) => {
    const m = src.match(new RegExp('\\n  ' + name + ': \\{([^}]*)\\}'));
    assert.ok(m, name);
    return m[1];
  };
  assert.ok(style('rowLabelText').includes('...typography.bodyMd,'));
  assert.ok(style('rowHelp').includes('...text.body,'));
  assert.ok(style('rowHelp').includes('color: colors.onSurfaceVariant,'));
  assert.ok(style('rowTall').includes('paddingVertical: spacing.base * 1.5,'));
  assert.ok(style('rowText').includes('gap: spacing.base * 0.5,'));
  for (const s of ['rowLabelText', 'rowHelp', 'rowTall', 'rowText']) {
    assert.ok(!/fontFamily|fontWeight|fontSize/.test(style(s)), `${s}: text roles only`);
  }
  const pill = read('src/components/PillSwitch.tsx');
  assert.ok(pill.includes('importantForAccessibility="no-hide-descendants" accessibilityElementsHidden'));
  assert.ok(!/Pressable|onPress/.test(pill), 'the row takes the tap');
});

test('wording: premium and plain; no long dashes, emoji or "X, not Y"', () => {
  const src = read('app/settings.tsx');
  const help = src.match(/const VOICE_GUIDANCE_HELP = '([^']*)';/)[1];
  for (const s of ['Voice guidance', help]) {
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(s), s);
    assert.ok(!/,\s*not\b|\bnot\s+\w+,/i.test(s), `no "X, not Y": ${s}`);
  }
  assert.ok(help.length <= 70, 'one short line');
  for (const f of ['src/state/audioSettings.ts', 'src/components/PillSwitch.tsx']) {
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(read(f)), f);
  }
});
