// Voice step 6, part 1: background playback config. Offline check of what the
// config plugins produce (expo config --type introspect, run from
// node_modules, no network) for the normal and the development app: exactly
// two new Android permissions (FOREGROUND_SERVICE and
// FOREGROUND_SERVICE_MEDIA_PLAYBACK), expo-audio's media playback service, and
// RECORD_AUDIO still removed.
// Run with:
//   node --test tests/session/backgroundAudio.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const repo = path.join(__dirname, '..', '..');
const CLI = path.join(repo, 'node_modules/expo/bin/cli');

function introspect(variant) {
  const env = { ...process.env };
  if (variant === 'development') env.APP_VARIANT = 'development';
  else delete env.APP_VARIANT;
  const out = execFileSync(process.execPath, [CLI, 'config', '--type', 'introspect', '--json'], {
    cwd: repo,
    env,
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const config = JSON.parse(out.toString());
  const manifest = config._internal.modResults.android.manifest.manifest;
  const perms = (manifest['uses-permission'] || []).map((p) => ({ name: p.$['android:name'], node: p.$['tools:node'] }));
  return {
    pkg: config.android.package,
    kept: perms.filter((p) => !p.node).map((p) => p.name).sort(),
    removed: perms.filter((p) => p.node === 'remove').map((p) => p.name).sort(),
    services: manifest.application[0].service || [],
  };
}

const KEPT = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.INTERNET',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.VIBRATE',
];
// Unchanged from before background playback (app.json blockedPermissions).
const REMOVED = [
  'android.permission.CAMERA',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

test('app.json: expo-audio background playback on, recording still off', () => {
  const app = JSON.parse(fs.readFileSync(path.join(repo, 'app.json'), 'utf8'));
  const audio = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-audio');
  assert.deepEqual(audio[1], { enableBackgroundPlayback: true, recordAudioAndroid: false });
  assert.ok(app.expo.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
  // app.config.ts changes only the development app's name, package and scheme.
  assert.ok(!/plugins|expo-audio|Permission/.test(fs.readFileSync(path.join(repo, 'app.config.ts'), 'utf8').replace(/\/\/.*$/gm, '')));
});

for (const variant of ['production', 'development']) {
  test(`resolved Android manifest (${variant} app): exactly the two new permissions, the media service, no RECORD_AUDIO`, () => {
    const m = introspect(variant);
    assert.equal(m.pkg, variant === 'development' ? 'com.smarttech1.breathingapp.dev' : 'com.smarttech1.breathingapp');
    // Before: INTERNET, VIBRATE, MODIFY_AUDIO_SETTINGS. Now exactly two more.
    assert.deepEqual(m.kept, KEPT);
    assert.deepEqual(m.removed, REMOVED, 'RECORD_AUDIO and the rest still removed');
    for (const p of ['POST_NOTIFICATIONS', 'FOREGROUND_SERVICE_MICROPHONE', 'RECORD_AUDIO']) {
      assert.ok(!m.kept.includes(`android.permission.${p}`), p);
    }
    assert.equal(m.services.length, 1, 'one service');
    assert.deepEqual(m.services[0], {
      $: {
        'android:name': 'expo.modules.audio.service.AudioControlsService',
        'android:exported': 'false',
        'android:foregroundServiceType': 'mediaPlayback',
      },
      'intent-filter': [{ action: [{ $: { 'android:name': 'androidx.media3.session.MediaSessionService' } }] }],
    });
  });
}
