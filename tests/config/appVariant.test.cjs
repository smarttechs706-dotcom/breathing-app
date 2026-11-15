// The development app variant (app.config.ts + eas.json). The real config is
// checked with `expo config --type introspect`; these tests pin the source so a
// later edit cannot quietly change the preview or store app's identity.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');

test('app.json keeps the store identity: Breathease, breathingapp, com.smarttech1.breathingapp', () => {
  const { expo } = JSON.parse(read('app.json'));
  assert.equal(expo.name, 'Breathease');
  assert.equal(expo.scheme, 'breathingapp');
  assert.equal(expo.android.package, 'com.smarttech1.breathingapp');
  assert.equal(expo.android.blockedPermissions.length, 10);
});

test('app.config.ts: only APP_VARIANT=development changes the name, scheme and package', () => {
  const src = read('app.config.ts');
  assert.ok(src.includes("const IS_DEV = process.env.APP_VARIANT === 'development';"));
  assert.ok(src.includes('if (!IS_DEV) return config as ExpoConfig;'), 'app.json unchanged without the variant');
  assert.ok(src.includes("name: 'Breathease Dev',"));
  assert.ok(src.includes("scheme: 'breathingapp-dev',"));
  assert.ok(src.includes("package: 'com.smarttech1.breathingapp.dev',"));
  // Spreads the rest of app.json (plugins, blocked permissions, allowBackup).
  assert.ok(src.includes('...config,'));
  assert.ok(src.includes('...config.android,'));
  assert.ok(!/plugins|blockedPermissions|permissions:/.test(src.replace(/\/\/.*$/gm, '')), 'no plugin or permission overrides');
});

test('eas.json: only the development profile sets APP_VARIANT; preview and production unchanged', () => {
  const { build } = JSON.parse(read('eas.json'));
  assert.deepEqual(build.development.env, { APP_VARIANT: 'development' });
  assert.equal(build.development.developmentClient, true);
  assert.deepEqual(build.preview, { distribution: 'internal', environment: 'preview', autoIncrement: true, android: { buildType: 'apk' } });
  assert.deepEqual(build.production, { environment: 'production', autoIncrement: true, android: { buildType: 'app-bundle' } });
});

test('npm run start:dev starts Metro with APP_VARIANT=development for the dev client', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['start:dev'], 'node scripts/start-dev.mjs');
  assert.equal(pkg.scripts.start, 'expo start');
  const src = read('scripts/start-dev.mjs');
  assert.ok(src.includes("env: { ...process.env, APP_VARIANT: 'development' },"));
  assert.ok(src.includes("[cli, 'start', '--dev-client', ...process.argv.slice(2)]"));
});
