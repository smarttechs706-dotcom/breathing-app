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

test('Settings keeps the account actions and drops Email, First name and the reminder card', () => {
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

test("ScreenBackdrop's painting prop is optional and no screen passes it yet", () => {
  assert.ok(read('src/features/profile/ScreenBackdrop.tsx').includes('painting?: ImageSourcePropType'));
  for (const f of ['app/settings.tsx', 'app/reminder.tsx', 'src/features/profile/ProfileScreen.tsx']) {
    const src = read(f);
    assert.ok(src.includes('<ScreenBackdrop />'), f);
    assert.ok(!src.includes('painting='), f);
  }
});
