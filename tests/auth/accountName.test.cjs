const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const validation = loadTs('src/auth/validation.ts');
const { accountFirstName, accountInitial, homeGreeting } = loadTs('src/auth/accountName.ts', {
  stubs: { './validation': validation },
});

test('the name comes from the account', () => {
  assert.equal(accountFirstName({ user_metadata: { display_name: 'Ada' } }), 'Ada');
});

test('a missing or unusable name counts as none', () => {
  for (const user of [
    null,
    undefined,
    {},
    { user_metadata: {} },
    { user_metadata: { display_name: 42 } },
    { user_metadata: { display_name: '   ' } },
  ]) {
    assert.equal(accountFirstName(user), null);
  }
});

test('a stored name is cleaned up on read', () => {
  const name = accountFirstName({ user_metadata: { display_name: ` A\nda ${'x'.repeat(60)}` } });
  assert.ok(name.length <= validation.MAX_FIRST_NAME_LENGTH);
  assert.doesNotMatch(name, /[\r\n]/);
  assert.equal(name, name.trim());
});

test('the avatar letter is the first letter of the name, uppercase', () => {
  assert.equal(accountInitial('ada'), 'A');
  assert.equal(accountInitial('Ömer'), 'Ö');
});

test('no name means no avatar letter, so the person icon shows', () => {
  assert.equal(accountInitial(null), null);
});

test('a name starting with an emoji keeps the whole character', () => {
  assert.equal(accountInitial('😀 Ada'), '😀');
});

test('Home greets by name, and still reads well without one', () => {
  assert.equal(homeGreeting('Ada'), 'Hi, Ada');
  assert.equal(homeGreeting(null), 'Hi there');
});
