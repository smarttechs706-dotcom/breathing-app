const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const load = () => loadTs('src/auth/cooldown.ts');

test('nothing is waiting before a cooldown starts', () => {
  assert.equal(load().cooldownSecondsLeft('resend'), 0);
});

test('counts down from the full wait to zero', () => {
  const { COOLDOWN_SECONDS, cooldownSecondsLeft, startCooldown } = load();
  startCooldown('resend', 0);

  assert.equal(cooldownSecondsLeft('resend', 0), COOLDOWN_SECONDS);
  assert.equal(cooldownSecondsLeft('resend', 30_500), 30);
  assert.equal(cooldownSecondsLeft('resend', COOLDOWN_SECONDS * 1000), 0);
  assert.equal(cooldownSecondsLeft('resend', 999_999), 0);
});

test('resend and forgot wait separately', () => {
  const { cooldownSecondsLeft, startCooldown } = load();
  startCooldown('forgot', 0);
  assert.equal(cooldownSecondsLeft('resend', 0), 0);
  assert.ok(cooldownSecondsLeft('forgot', 0) > 0);
});

test('the wait lives outside any screen, so reading it again does not reset it', () => {
  const { cooldownSecondsLeft, startCooldown } = load();
  startCooldown('forgot', 0);
  cooldownSecondsLeft('forgot', 10_000);
  assert.equal(cooldownSecondsLeft('forgot', 20_000), 40);
});
