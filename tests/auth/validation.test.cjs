const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('./helpers.cjs');

const { isValidEmail, isValidNewPassword, normalizeEmail, normalizeFirstName } = loadTs(
  'src/auth/validation.ts'
);

test('emails are trimmed but otherwise kept as typed', () => {
  assert.equal(normalizeEmail('  Name+tag@Example.com '), 'Name+tag@Example.com');
});

test('accepts ordinary addresses', () => {
  for (const email of ['a@b.co', 'name+tag@example.com', 'a.b@sub.example.org']) {
    assert.equal(isValidEmail(email), true);
  }
});

test('rejects obvious typos', () => {
  for (const email of ['', 'name', 'name@', '@example.com', 'name@example', 'a b@c.co']) {
    assert.equal(isValidEmail(email), false);
  }
});

test('first names are trimmed, kept to one line and capped at 30 characters', () => {
  assert.equal(normalizeFirstName('  Sam  '), 'Sam');
  assert.equal(normalizeFirstName('Sam\nLee'), 'Sam Lee');
  assert.equal(normalizeFirstName('x'.repeat(50)).length, 30);
});

test('a name of only spaces is empty', () => {
  assert.equal(normalizeFirstName('   \n '), '');
});

test('new passwords need at least 8 characters', () => {
  assert.equal(isValidNewPassword('1234567'), false);
  assert.equal(isValidNewPassword('12345678'), true);
});
