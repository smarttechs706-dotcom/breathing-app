const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const { createSingleFlight } = loadTs('src/auth/singleFlight.ts');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('eleven taps during one request send one request', async () => {
  const gate = deferred();
  const flight = createSingleFlight(() => {});
  let calls = 0;
  const action = () => {
    calls += 1;
    return gate.promise;
  };

  const taps = Array.from({ length: 11 }, () => flight.run(action));
  gate.resolve('done');
  const results = await Promise.all(taps);

  assert.equal(calls, 1);
  assert.equal(results[0], 'done');
  assert.ok(results.slice(1).every((result) => result === undefined));
});

test('the lock is taken before the action starts, with no await in between', () => {
  const flight = createSingleFlight(() => {});
  let calls = 0;
  void flight.run(async () => {
    calls += 1;
    await new Promise(() => {});
  });
  void flight.run(async () => {
    calls += 1;
  });
  assert.equal(calls, 1);
});

test('reports running, then not running', async () => {
  const seen = [];
  const flight = createSingleFlight((running) => seen.push(running));
  await flight.run(async () => {});
  assert.deepEqual(seen, [true, false]);
});

test('a later tap works once the first finishes', async () => {
  const flight = createSingleFlight(() => {});
  let calls = 0;
  await flight.run(async () => {
    calls += 1;
  });
  await flight.run(async () => {
    calls += 1;
  });
  assert.equal(calls, 2);
});

test('a failure releases the lock and is never retried', async () => {
  const flight = createSingleFlight(() => {});
  let calls = 0;
  await assert.rejects(
    flight.run(async () => {
      calls += 1;
      throw new Error('failed');
    })
  );
  assert.equal(calls, 1);
  assert.equal(await flight.run(async () => 'next'), 'next');
});
