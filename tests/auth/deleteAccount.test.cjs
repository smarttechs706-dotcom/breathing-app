const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

function setup({ deleteFails = false, cancelOk = true } = {}) {
  const events = [];
  const { deleteMyData } = loadTs('src/utils/deleteMyData.ts', {
    stubs: {
      'react-native': { Alert: {}, Platform: { OS: 'android' } },
      '../api/client': {
        deleteUserData: async () => {
          events.push('server');
          if (deleteFails) throw new Error('failed');
        },
      },
      '../state/sessionsCache': { clearCachedSessions: () => events.push('sessions') },
      '../features/profile/profilePhotoStore': {
        forgetProfilePhoto: async (userId) => events.push(`photo ${userId}`),
      },
      '../features/session/lastPatternStore': {
        clearLastPattern: async (userId) => events.push(`last pattern ${userId}`),
      },
      './reminders': {
        applyReminderSchedule: async () => {
          events.push('cancel reminder');
          return { ok: cancelOk };
        },
        clearReminderSettings: async () => events.push('clear reminder'),
      },
    },
  });
  return { deleteMyData, events };
}

test('a delete clears local data after the server, and leaves onboarding alone', async () => {
  const { deleteMyData, events } = setup();
  assert.equal(await deleteMyData('user-1234-abcd'), 'deleted');
  assert.deepEqual(events, [
    'server',
    'cancel reminder',
    'clear reminder',
    'sessions',
    'photo user-1234-abcd',
    'last pattern user-1234-abcd',
  ]);
});

test('a failed server delete touches nothing on this phone', async () => {
  const { deleteMyData, events } = setup({ deleteFails: true });
  assert.equal(await deleteMyData(), 'failed');
  assert.deepEqual(events, ['server']);
});

test('a reminder that could not be cancelled keeps its setting', async () => {
  const { deleteMyData, events } = setup({ cancelOk: false });
  assert.equal(await deleteMyData(), 'reminder-not-cancelled');
  assert.ok(!events.includes('clear reminder'));
});
