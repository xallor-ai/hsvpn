'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encryptPassword } = require('../src/crypto');

test('encryptPassword produces Base64 HSCA blob', () => {
  const out = encryptPassword('test-pass');
  assert.equal(typeof out, 'string');
  assert.match(out, /^[A-Za-z0-9+/=]+$/);
  const raw = Buffer.from(out, 'base64');
  assert.equal(raw.subarray(0, 4).toString('ascii'), 'HSCA');
  assert.equal(raw[4], 0x30);
  assert.equal(raw[5], 0x00);
  assert.ok(raw.length > 6);
});

test('encryptPassword rejects empty', () => {
  assert.throws(() => encryptPassword(''), /non-empty/);
});