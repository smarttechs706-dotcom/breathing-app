// Source checks for the Fraunces title font. Run with:
//   node --test tests/fonts/fonts.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');

test('tokens: a display family and a displayTitle role with no fontWeight', () => {
  const src = read('src/theme/tokens.ts');
  assert.ok(src.includes("display: 'FrauncesDisplay',"));
  const role = src.slice(src.indexOf('displayTitle: {'), src.indexOf('displayLg: {'));
  assert.ok(role.includes('fontFamily: fontFamilies.display'));
  assert.ok(!role.includes('fontWeight'), 'no fontWeight on the Fraunces role');
});

test('text.name and text.pageTitle use the Fraunces role', () => {
  const src = read('src/features/home/styles.ts');
  assert.ok(src.includes('name: { ...typography.displayTitle,'));
  assert.ok(src.includes('pageTitle: { ...typography.displayTitle,'));
});

test('player titles use the role; nothing sets the Fraunces family by hand', () => {
  const player = read('app/session-player.tsx');
  assert.ok(/sessionTitle: \{\s*\.\.\.typography\.displayTitle/.test(player));
  assert.ok(/completeHeadline: \{\s*\.\.\.typography\.displayTitle/.test(player));
  for (const dir of ['app', 'src']) {
    const walk = (d) =>
      fs.readdirSync(path.join(repo, d), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []
      );
    for (const f of walk(dir)) {
      if (f.replace(/\\/g, '/').endsWith('src/theme/tokens.ts')) continue;
      assert.ok(!/Fraunces_|'FrauncesDisplay'/.test(read(f)) || f.replace(/\\/g, '/').endsWith('app/_layout.tsx'), f);
    }
  }
});

test('layout: loads only the one Fraunces file and carries on if fonts fail', () => {
  const src = read('app/_layout.tsx');
  assert.ok(src.includes("from '@expo-google-fonts/fraunces/500Medium'"));
  assert.ok(!/from '@expo-google-fonts\/fraunces'/.test(src), 'not the main entry (it bundles every weight)');
  assert.ok(src.includes('[fontFamilies.display]: FrauncesDisplayFile,'));
  assert.ok(src.includes('const [fontsLoaded, fontError] = useFonts({'));
  assert.ok(src.includes('if (!fontsLoaded && !fontError) {'));
});
