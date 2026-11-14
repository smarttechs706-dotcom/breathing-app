// Tests for the session clock (src/utils/sessionClock.ts), with a fake clock.
// Run with:
//   node --test tests/session/sessionClock.test.cjs

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const c = loadTs('src/utils/sessionClock.ts');

// Runs the clock from `start` to `end`, beating every `everyMs` like the
// player's tick does while the session is on screen.
function runWithBeats(state, start, end, everyMs = 1000) {
  let s = c.setRunning(state, true, start);
  for (let t = start + everyMs; t <= end; t += everyMs) s = c.beat(s, t);
  return s;
}

test('normal run: counts exactly the running time', () => {
  const s = runWithBeats(c.INITIAL_CLOCK, 0, 120000);
  assert.equal(c.elapsedMs(s, 120000), 120000);
  const stopped = c.setRunning(s, false, 120400);
  assert.equal(c.elapsedMs(stopped, 120400), 120400);
  assert.equal(c.elapsedMs(stopped, 999999), 120400, 'nothing counts while stopped');
});

test('pause and resume (stop stamped on time): the paused minute does not count', () => {
  let s = runWithBeats(c.INITIAL_CLOCK, 0, 60000);
  s = c.setRunning(s, false, 60000); // pause at 1:00
  s = runWithBeats(s, 120000, 150000); // resume a minute later, 30 s more
  assert.equal(c.elapsedMs(s, 150000), 90000);
});

test('the reported bug: lock at 2:00 for 60 s, stop only processed on unlock', () => {
  let s = runWithBeats(c.INITIAL_CLOCK, 0, 120000); // last beat at 2:00
  // Locked: no beats, no stop. On unlock (3:00) the late stop arrives.
  s = c.setRunning(s, false, 180000);
  const counted = c.elapsedMs(s, 180000);
  assert.equal(counted, 120000, `counted ${counted} ms, the locked minute must not count`);
  // Resume and breathe 10 s more.
  s = runWithBeats(s, 180000, 190000);
  assert.equal(c.elapsedMs(s, 190000), 130000);
});

test('frozen timers with no stop at all: the next beat drops the gap', () => {
  let s = runWithBeats(c.INITIAL_CLOCK, 0, 60000);
  // 60 s with nothing (no AppState event, timers held), then ticking again.
  s = c.beat(s, 120000);
  assert.equal(c.elapsedMs(s, 120000), 60000);
  s = runWithBeats({ ...s }, 120000, 125000); // setRunning(true) is a no-op while running
  assert.equal(c.elapsedMs(s, 125000), 65000);
});

test('reading the clock during a gap never counts the unobserved time', () => {
  const s = runWithBeats(c.INITIAL_CLOCK, 0, 30000);
  assert.equal(c.elapsedMs(s, 31000), 31000); // normal, within a second
  assert.equal(c.elapsedMs(s, 90000), 30000); // long gap: up to the last beat only
});

test('a lock costs at most the time since the last beat (under one second here)', () => {
  // Last beat at 59.2 s, locked at 59.9 s, stop processed on unlock at 2:00.
  let s = runWithBeats(c.INITIAL_CLOCK, 0, 59000);
  s = c.beat(s, 59200);
  s = c.setRunning(s, false, 120000);
  const counted = c.elapsedMs(s, 120000);
  assert.equal(counted, 59200);
  assert.ok(59900 - counted < 1000);
});

test('Settings or pause in the foreground (beats keep coming): exact', () => {
  let s = runWithBeats(c.INITIAL_CLOCK, 0, 10000, 250);
  s = c.setRunning(s, false, 10100);
  assert.equal(c.elapsedMs(s, 10100), 10100);
});

test('never more than wall time, never backwards, idempotent start and stop', () => {
  let s = c.setRunning(c.INITIAL_CLOCK, true, 1000);
  assert.deepEqual(c.setRunning(s, true, 5000), s, 'start again is a no-op');
  let prev = 0;
  for (let t = 1000; t <= 20000; t += 700) {
    s = c.beat(s, t);
    const e = c.elapsedMs(s, t);
    assert.ok(e >= prev, 'never backwards');
    assert.ok(e <= t - 1000, 'never more than wall time');
    prev = e;
  }
  const stopped = c.setRunning(s, false, 20000);
  assert.deepEqual(c.setRunning(stopped, false, 30000), stopped, 'stop again is a no-op');
  assert.deepEqual(c.beat(stopped, 40000), stopped, 'beat while stopped is a no-op');
});

test('the player stops the clock in the AppState listener and beats on every tick', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const player = fs.readFileSync(path.join(__dirname, '..', '..', 'app/session-player.tsx'), 'utf8');
  assert.ok(player.includes("if (s !== 'active') clockRef.current = setClockRunning(clockRef.current, false, Date.now());"));
  assert.ok(player.includes('clockRef.current = clockBeat(setClockRunning(clockRef.current, true, now), now);'));
  assert.equal(c.MAX_GAP_MS, 2500);
});
