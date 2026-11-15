// Tests for the Profile tab's pure helpers (src/features/profile). Run with:
//   node --test tests/profile/profile.test.cjs
// Reuses the auth tests' TypeScript loader; it is not part of `npm run test:auth`.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const p = loadTs('src/features/profile/profileModel.ts');

test('stat labels read correctly: "1 day", "1 session", "10 min"', () => {
  assert.equal(p.dayCount(1), '1 day');
  assert.equal(p.dayCount(0), '0 days');
  assert.equal(p.dayCount(12), '12 days');
  assert.equal(p.sessionCount(1), '1 session');
  assert.equal(p.sessionCount(0), '0 sessions');
  assert.equal(p.sessionCount(3), '3 sessions');
  assert.equal(p.minutesLabel(10), '10 min');
  assert.equal(p.minutesLabel(0), '0 min');
});

test('stat labels never show a negative or broken number', () => {
  assert.equal(p.dayCount(-2), '0 days');
  assert.equal(p.sessionCount(Number.NaN), '0 sessions');
  assert.equal(p.minutesLabel(9.7), '9 min');
});

test('the reminder row shows the time, or "Off"', () => {
  assert.equal(p.reminderLabel({ enabled: true, hour: 20, minute: 0 }), '8:00 PM');
  assert.equal(p.reminderLabel({ enabled: true, hour: 0, minute: 5 }), '12:05 AM');
  assert.equal(p.reminderLabel({ enabled: true, hour: 12, minute: 30 }), '12:30 PM');
  assert.equal(p.reminderLabel({ enabled: true, hour: 7, minute: 45 }), '7:45 AM');
  assert.equal(p.reminderLabel({ enabled: false, hour: 20, minute: 0 }), 'Off');
  assert.equal(p.reminderLabel({ enabled: true, hour: null, minute: null }), 'Off');
  assert.equal(p.reminderLabel(null), 'Off');
});

test('Profile has only Settings and Daily reminder; the reminder row opens the Reminder screen', () => {
  assert.deepEqual(
    p.PROFILE_ROWS.map((r) => r.key),
    ['settings', 'reminder']
  );
  const targets = Object.fromEntries(p.PROFILE_ROWS.map((r) => [r.key, r.target]));
  assert.deepEqual(targets.settings, { kind: 'route', href: '/settings' });
  assert.deepEqual(targets.reminder, { kind: 'route', href: '/reminder' });
  assert.ok(!p.PROFILE_ROWS.some((r) => /help|password|privacy|sign out/i.test(r.label)));
});

const fs = require('node:fs');
const path = require('node:path');
const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');

test('Profile no longer has Change password, Privacy Policy or Sign out', () => {
  const src = read('src/features/profile/ProfileScreen.tsx');
  assert.ok(!/signOut|openPrivacyPolicy|change-password/.test(src));
});

// The 2026-11-09 cleanup removed the old Email and First name rows and the
// reminder card from Settings. Since 2026-11-15 the email is back only as the
// read-only "Account" row (moved there from the Profile header), never as an
// editable "Email" field.
test('Settings keeps the account actions, shows the email only as the Account row, no First name or reminder card', () => {
  const src = read('app/settings.tsx');
  for (const must of [
    "onPress={() => router.push('/change-password')}",
    'onPress={handleSignOut}',
    'onPress={handleDeleteAccount}',
    'onPress={openPrivacyPolicy}',
    'if (await confirmSignOut()) await signOut();',
    'const result = await deleteMyData();',
  ]) assert.ok(src.includes(must), must);
  assert.ok(!/EditNameModal|TimePickerModal|>Email<|First name|Daily Reminder|backgroundGlow/.test(src));
});

test('the Reminder screen is registered inside the signed-in guard and uses the same wording', () => {
  const layout = read('app/_layout.tsx');
  const guard = layout.slice(layout.indexOf("guard={status === 'signedIn'}"));
  assert.ok(guard.slice(0, guard.indexOf('</Stack.Protected>')).includes('<Stack.Screen name="reminder" />'));
  assert.ok(read('app/reminder.tsx').includes('reminderLabel(reminderSettings)'));
});

test('the mist painting is behind Home, Library, Profile, Settings, Reminder and Change password only', () => {
  const backdrop = read('src/features/profile/ScreenBackdrop.tsx');
  assert.ok(backdrop.includes('painting?: ImageSourcePropType'));
  assert.ok(/export const MIST_TINT = 0\.\d+;/.test(backdrop), 'tint in one constant');
  assert.ok(fs.existsSync(path.join(repo, 'src/features/profile/images/mist-background.jpg')));
  for (const f of [
    'src/features/home/HomeScreen.tsx',
    'src/features/library/LibraryScreen.tsx',
    'src/features/profile/ProfileScreen.tsx',
    'app/settings.tsx',
    'app/reminder.tsx',
    // The sign-in screens and Change password get it through the shared AuthScreen.
    'src/components/auth/AuthScreen.tsx',
  ]) assert.ok(read(f).includes('<ScreenBackdrop painting={MIST_BACKGROUND} />'), f);
  for (const f of ['app/(tabs)/insights.tsx', 'app/session-player.tsx']) {
    assert.ok(!read(f).includes('MIST_BACKGROUND'), f);
  }
});

// --- Email: Settings "Account" row, not on Profile (2026-11-15) -------------

test('Profile no longer reads or shows the email', () => {
  const src = read('src/features/profile/ProfileScreen.tsx');
  assert.ok(!/session\?\.user\.email|\{email\}|styles\.email\b|\n  email: \{/.test(src));
});

test('Settings: one read-only Account row with the email, first in the first card', () => {
  const src = read('app/settings.tsx');
  assert.equal((src.match(/>Account</g) || []).length, 1);
  const row = src.slice(src.indexOf('{email && ('), src.indexOf('</View>', src.indexOf('{email && (')));
  assert.ok(row.includes('accessibilityLabel={`Account, ${email}`}'));
  assert.ok(row.includes('<Text style={styles.rowLabel}>Account</Text>'));
  assert.ok(row.includes('style={[styles.rowValue, styles.rowValueShrink]} numberOfLines={1} ellipsizeMode="middle"'));
  assert.ok(!/onPress|Pressable/.test(row), 'not tappable');
  // Before Change password, inside the first card.
  const firstCard = src.slice(src.indexOf('<PreviewGlass radius={CARD_RADIUS}>'), src.indexOf('</PreviewGlass>'));
  assert.ok(firstCard.indexOf('{email && (') > -1 && firstCard.indexOf('{email && (') < firstCard.indexOf("router.push('/change-password')"));
  // The email comes from the signed-in session.
  assert.ok(src.includes('const email = session?.user.email ?? null;'));
});

test('the changed lines have no long dashes or emoji; the auth link screens still show AccountEmail', () => {
  for (const f of ['app/settings.tsx', 'src/features/profile/ProfileScreen.tsx']) {
    const lines = read(f).split(/\r?\n/).filter((l) => /Account|email/.test(l));
    for (const l of lines) assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(l), `${f}: ${l}`);
  }
  assert.ok(read('app/auth/callback.tsx').includes('<AccountEmail prefix="Signed in as" email={session.user.email} />'));
  assert.ok(read('app/auth/signed-in.tsx').includes('<AccountEmail prefix="Signed in as" email={session.user.email} />'));
  assert.ok(read('app/reset-password.tsx').includes('<AccountEmail prefix="Changing the password for" email={session.user.email} />'));
});
