// Tests for the voice-driven session clock (voice step 6,
// src/features/session/audio/voiceClock.ts): the player's position as breathed
// time, the end, the app's play/pause, plays and pauses from outside the app,
// the lock screen details and the audio mode. Offline, pure.
// Run with:
//   node --test tests/session/voiceClock.test.cjs

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const vc = loadTs('src/features/session/audio/voiceClock.ts');
const bp = loadTs('src/features/session/breathPattern.ts');

test('clock: the player position is the breathed time, never below 0 or past the end', () => {
  assert.equal(vc.voiceElapsedMs(12345, 285000), 12345);
  assert.equal(vc.voiceElapsedMs(285000, 285000), 285000);
  assert.equal(vc.voiceElapsedMs(290000, 285000), 285000, 'capped at the end');
  assert.equal(vc.voiceElapsedMs(-5, 285000), 0);
  assert.equal(vc.voiceElapsedMs(NaN, 285000), 0);
  // The same breath state as the circle: 4-7-8 at 9.5 s into the voice is the hold.
  const p = { inhale: 4, hold: 7, exhale: 8, rest: 0 };
  assert.equal(bp.breathAt(p, vc.voiceElapsedMs(9500, 285000)).phase, 'hold');
});

test('end: the track counts as finished when the player says so, or within 120 ms of the end', () => {
  assert.equal(vc.END_TOLERANCE_MS, 120);
  assert.equal(vc.trackFinished(284880, 285000, false), true, '120 ms before');
  assert.equal(vc.trackFinished(284879, 285000, false), false);
  assert.equal(vc.trackFinished(100, 285000, true), true, 'didJustFinish');
  assert.equal(vc.trackFinished(0, 0, false), false, 'no session');
  // Ended while away: on return the position is at the end, so the clock reads
  // the end and the screen shows Session Complete (elapsedMs >= endMs).
  const end = 285000;
  assert.ok(vc.trackFinished(284999, end, false) && vc.voiceElapsedMs(end, end) >= end);
});

test("app's play and pause: from what the session wants, not from the app being in front", () => {
  assert.equal(vc.playerCommand(true, false), 'play');
  assert.equal(vc.playerCommand(false, true), 'pause');
  assert.equal(vc.playerCommand(true, true), null);
  assert.equal(vc.playerCommand(false, false), null);
});

test('outside the app: notification or lock screen pause and play, calls, other apps', () => {
  assert.equal(vc.COMMAND_GRACE_MS, 600);
  const base = { loaded: true, finished: false, msSinceCommand: 5000 };
  // Notification pause (or a call, or another app taking the audio).
  assert.equal(vc.externalChange({ ...base, wanted: true, playing: false }), 'paused');
  // Notification play (or expo-audio resuming after a call).
  assert.equal(vc.externalChange({ ...base, wanted: false, playing: true }), 'resumed');
  // Agreement: nothing to do.
  assert.equal(vc.externalChange({ ...base, wanted: true, playing: true }), null);
  assert.equal(vc.externalChange({ ...base, wanted: false, playing: false }), null);
  // Right after our own command the state may still lag: not someone else.
  assert.equal(vc.externalChange({ ...base, wanted: true, playing: false, msSinceCommand: 599 }), null);
  assert.equal(vc.externalChange({ ...base, wanted: true, playing: false, msSinceCommand: 600 }), 'paused');
  // The end of the track stops playing: that is Session Complete, not a pause.
  assert.equal(vc.externalChange({ ...base, wanted: true, playing: false, finished: true }), null);
  // Still loading: not a pause.
  assert.equal(vc.externalChange({ ...base, wanted: true, playing: false, loaded: false }), null);
});

test('lock screen and notification: session title and "Breathease", no artwork, no seek buttons', () => {
  assert.deepEqual(vc.lockScreenMetadata('Box Breathing'), { title: 'Box Breathing', artist: 'Breathease' });
  assert.deepEqual(vc.lockScreenMetadata('Your pattern'), { title: 'Your pattern', artist: 'Breathease' });
  assert.deepEqual(vc.lockScreenMetadata('  '), { title: 'Breathease', artist: 'Breathease' });
  assert.deepEqual(vc.lockScreenMetadata(null), { title: 'Breathease', artist: 'Breathease' });
  for (const t of ['Box Breathing', null]) {
    const m = vc.lockScreenMetadata(t);
    assert.deepEqual(Object.keys(m).sort(), ['artist', 'title'], 'no artworkUrl, no album');
  }
  assert.deepEqual({ ...vc.LOCK_SCREEN_OPTIONS }, { showSeekForward: false, showSeekBackward: false });
});

test('audio mode while the voice plays: doNotMix, background, silent mode', () => {
  assert.deepEqual({ ...vc.VOICE_AUDIO_MODE }, { interruptionMode: 'doNotMix', shouldPlayInBackground: true, playsInSilentMode: true });
});
