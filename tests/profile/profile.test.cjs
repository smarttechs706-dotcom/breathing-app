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

test('the rows link only to existing screens, in order, and there is no Help row', () => {
  assert.deepEqual(
    p.PROFILE_ROWS.map((r) => r.key),
    ['settings', 'reminder', 'password', 'privacy']
  );
  const targets = Object.fromEntries(p.PROFILE_ROWS.map((r) => [r.key, r.target]));
  assert.deepEqual(targets.settings, { kind: 'route', href: '/settings' });
  assert.deepEqual(targets.reminder, { kind: 'route', href: '/settings' });
  assert.deepEqual(targets.password, { kind: 'route', href: '/change-password' });
  assert.deepEqual(targets.privacy, { kind: 'privacy' });
  assert.ok(!p.PROFILE_ROWS.some((r) => /help/i.test(r.label)));
});
