const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const TOKEN = 'test-access-token';
const USER = '11111111-1111-4111-8111-111111111111';
const session = { access_token: TOKEN, user: { id: USER } };
const CHECKIN = { sessionId: 'deep-exhale', preMood: 2, postMood: 4 };

const INSIGHTS = {
  checkins: [],
  streak: { currentStreak: 1, longestStreak: 1, lastSessionDate: '2026-11-07' },
  totalSessions: 1,
  sessionsThisWeek: 1,
  mindfulMinutes: 3,
  monthOverMonthDelta: 0,
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function reply(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// Fresh module state per test. The error, expiry and held check-in code is the
// real code; only the outside world is stubbed.
function setup({ getSession, respond = () => reply(200, INSIGHTS) } = {}) {
  globalThis.__DEV__ = true;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url, ...init });
    return respond(url, init, requests.length);
  };

  const apiErrors = loadTs('src/api/apiErrors.ts');
  const expiry = loadTs('src/auth/sessionExpiry.ts');
  const pending = loadTs('src/state/pendingCheckin.ts');
  const signal = { saved: 0 };
  const signOut = { calls: 0 };
  expiry.setSessionExpiredHandler(() => {
    signOut.calls += 1;
  });

  const client = loadTs('src/api/client.ts', {
    env: { EXPO_PUBLIC_API_BASE_URL: 'https://api.test' },
    stubs: {
      'expo-constants': {
        __esModule: true,
        default: { executionEnvironment: 'bare' },
        ExecutionEnvironment: { StoreClient: 'storeClient' },
      },
      '../auth/supabase': {
        getAuth: () => ({
          getSession: getSession ?? (async () => ({ data: { session }, error: null })),
        }),
      },
      '../auth/sessionExpiry': expiry,
      '../state/checkinSignal': {
        markCheckinSaved: () => {
          signal.saved += 1;
        },
      },
      '../state/pendingCheckin': pending,
      './apiErrors': apiErrors,
    },
  });

  return { apiErrors, client, expiry, pending, requests, signal, signOut };
}

const failing = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to fail');
};

const accountCalls = {
  'POST /api/checkin': (client) => client.postCheckin(CHECKIN),
  'GET /api/insights': (client) => client.fetchInsights(),
  'DELETE /api/user': (client) => client.deleteUserData(),
};

for (const [name, call] of Object.entries(accountCalls)) {
  test(`${name} sends the Bearer token`, async () => {
    const { client, requests } = setup();
    await call(client);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.Authorization, `Bearer ${TOKEN}`);
  });
}

test('no request carries userId or user_id anywhere', async () => {
  const { client, requests } = setup({
    respond: (url) => reply(200, url.includes('/api/sessions') ? [] : INSIGHTS),
  });
  await client.postCheckin({ ...CHECKIN, userId: USER, user_id: USER });
  await client.fetchInsights(USER);
  await client.deleteUserData(USER);
  await client.fetchSessions('Calm');

  assert.equal(requests.length, 4);
  for (const request of requests) {
    const sent = `${request.url} ${request.body ?? ''}`;
    assert.doesNotMatch(sent, /user_?id/i);
    assert.ok(!sent.includes(USER));
  }
});

test('a check-in body holds exactly the three check-in fields', async () => {
  const { client, requests } = setup();
  await client.postCheckin({ ...CHECKIN, userId: USER });
  assert.deepEqual(JSON.parse(requests[0].body), CHECKIN);
});

test('the public session list sends no token, and a 401 there never signs out', async () => {
  const { client, requests, signOut } = setup({ respond: () => reply(401) });
  await failing(client.fetchSessions());
  assert.equal(requests[0].headers, undefined);
  assert.equal(signOut.calls, 0);
});

test('a 401 signs out and asks the user to sign in again', async () => {
  const { apiErrors, client, expiry, signOut } = setup({ respond: () => reply(401) });
  const error = await failing(client.fetchInsights());

  assert.equal(signOut.calls, 1);
  assert.equal(apiErrors.friendlyError(error), 'Please sign in again.');
  assert.equal(expiry.consumeSignInNotice(), true);
});

test('requests failing together sign out only once', async () => {
  const { client, signOut } = setup({ respond: () => reply(401) });
  await Promise.allSettled([client.fetchInsights(), client.fetchInsights(), client.deleteUserData()]);
  assert.equal(signOut.calls, 1);
});

test('a new login can sign out again later', async () => {
  const { client, expiry, signOut } = setup({ respond: () => reply(401) });
  await failing(client.fetchInsights());
  expiry.resetSessionExpiry();
  await failing(client.fetchInsights());
  assert.equal(signOut.calls, 2);
});

test('no session at all counts as a 401 and sends nothing', async () => {
  const { client, requests, signOut } = setup({
    getSession: async () => ({ data: { session: null }, error: null }),
  });
  const error = await failing(client.fetchInsights());
  assert.equal(error.status, 401);
  assert.equal(requests.length, 0);
  assert.equal(signOut.calls, 1);
});

test('a refresh the server refused signs out', async () => {
  const { client, signOut } = setup({
    getSession: async () => ({
      data: { session: null },
      error: { name: 'AuthApiError', status: 400 },
    }),
  });
  await failing(client.fetchInsights());
  assert.equal(signOut.calls, 1);
});

for (const name of ['AuthRetryableFetchError', 'AbortError', 'TypeError']) {
  test(`a refresh that failed with ${name} is offline, not a sign-out`, async () => {
    const { apiErrors, client, requests, signOut } = setup({
      getSession: async () => ({ data: { session: null }, error: { name, status: 0 } }),
    });
    const error = await failing(client.fetchInsights());
    assert.equal(apiErrors.friendlyError(error), "Can't reach the server, try again");
    assert.equal(requests.length, 0);
    assert.equal(signOut.calls, 0);
  });
}

test('a 503 keeps the user signed in and does not retry by itself', async () => {
  const { apiErrors, client, requests, signOut } = setup({ respond: () => reply(503) });
  const error = await failing(client.fetchInsights());
  assert.equal(apiErrors.friendlyError(error), "Can't reach the server, try again");
  assert.equal(requests.length, 1);
  assert.equal(signOut.calls, 0);
});

test('no network keeps the user signed in and does not retry by itself', async () => {
  const { apiErrors, client, requests, signOut } = setup({
    respond: () => {
      throw new TypeError('Network request failed');
    },
  });
  const error = await failing(client.postCheckin(CHECKIN));
  assert.equal(apiErrors.friendlyError(error), "Can't reach the server, try again");
  assert.equal(requests.length, 1);
  assert.equal(signOut.calls, 0);
});

test('a timeout reads as offline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { apiErrors, client, signOut } = setup({
    respond: (_url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  });
  const pendingCall = failing(client.fetchInsights());
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(10_000);

  assert.equal(apiErrors.friendlyError(await pendingCall), "Can't reach the server, try again");
  assert.equal(signOut.calls, 0);
});

test('a 429 asks the user to wait and keeps them signed in', async () => {
  const { apiErrors, client, requests, signOut } = setup({ respond: () => reply(429) });
  const error = await failing(client.fetchInsights());
  assert.equal(apiErrors.friendlyError(error), 'Too many requests, wait a moment.');
  assert.equal(requests.length, 1);
  assert.equal(signOut.calls, 0);
});

test('other failures show generic text, never a status or path', async () => {
  const { apiErrors, client, signOut } = setup({ respond: () => reply(500) });
  const error = await failing(client.fetchInsights());
  const message = apiErrors.friendlyError(error);
  assert.equal(message, 'Something went wrong. Please try again.');
  assert.doesNotMatch(message, /500|\/api/);
  assert.equal(signOut.calls, 0);
});

test('a wrong-shaped reply is generic, not offline and not a sign-out', async () => {
  const { apiErrors, client, signOut } = setup({ respond: () => reply(200, { nope: true }) });
  const error = await failing(client.fetchInsights());
  assert.equal(apiErrors.friendlyError(error), 'Something went wrong. Please try again.');
  assert.equal(signOut.calls, 0);
});

test('error text never carries the token', async () => {
  for (const status of [401, 429, 500, 503]) {
    const { client } = setup({ respond: () => reply(status) });
    const error = await failing(client.fetchInsights());
    assert.ok(!error.message.includes(TOKEN));
  }
});

test('a check-in that hits a 401 is held before the sign-out starts', async () => {
  const { client, expiry, pending } = setup({ respond: () => reply(401) });
  let heldAtSignOut = null;
  expiry.setSessionExpiredHandler(() => {
    heldAtSignOut = pending.takeHeldCheckin(USER);
  });
  await failing(client.postCheckin(CHECKIN));
  assert.deepEqual(heldAtSignOut, CHECKIN);
});

test('a held check-in is sent once when the same user is back', async () => {
  let status = 401;
  const { client, requests, signal } = setup({ respond: () => reply(status) });
  await failing(client.postCheckin(CHECKIN));

  status = 200;
  await client.sendHeldCheckin(USER);
  await client.sendHeldCheckin(USER);

  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(requests[1].body), CHECKIN);
  assert.equal(signal.saved, 1);
});

test('a held check-in is never sent for another account', async () => {
  let status = 401;
  const { client, requests } = setup({ respond: () => reply(status) });
  await failing(client.postCheckin(CHECKIN));

  status = 200;
  await client.sendHeldCheckin('22222222-2222-4222-8222-222222222222');
  await client.sendHeldCheckin(USER);

  assert.equal(requests.length, 1);
});

test('a failed resend stays quiet and does not hold the check-in again', async () => {
  const { client, pending, requests } = setup({ respond: () => reply(401) });
  await failing(client.postCheckin(CHECKIN));
  await client.sendHeldCheckin(USER);

  assert.equal(requests.length, 2);
  assert.equal(pending.takeHeldCheckin(USER), null);
});

test('other check-in failures are not held, because the screen offers Try Again', async () => {
  const { client, pending } = setup({ respond: () => reply(503) });
  await failing(client.postCheckin(CHECKIN));
  assert.equal(pending.takeHeldCheckin(USER), null);
});

test('eleven taps on a check-in send one request', async () => {
  const { createSingleFlight } = loadTs('src/auth/singleFlight.ts');
  const { client, requests } = setup();
  const flight = createSingleFlight(() => {});

  await Promise.all(
    Array.from({ length: 11 }, () => flight.run(() => client.postCheckin(CHECKIN)))
  );
  assert.equal(requests.length, 1);
});
