'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encodeFrame, buildStartMsg } = require('../src/dialer');

test('encodeFrame uses deaf + le version + le length', () => {
  const payload = Buffer.from('{"type":"get"}', 'utf8');
  const frame = encodeFrame(payload);
  assert.equal(frame.subarray(0, 4).toString('ascii'), 'deaf');
  assert.equal(frame.readUInt32LE(4), 2);
  assert.equal(frame.readUInt32LE(8), payload.length);
  assert.deepEqual(frame.subarray(12), payload);
});

test('buildStartMsg includes SPA and encryptedPassword', () => {
  const msg = buildStartMsg({
    gateway: { host: '1.2.3.4', port: 64433 },
    auth: { username: 'u' },
    password: 'secret',
    userdata_dir: '/tmp/ud',
    profile: 'ai-infra',
    enable_spa: true,
  });
  assert.equal(msg.type, 'start');
  assert.equal(msg.user, 'u');
  assert.equal(msg.server, '1.2.3.4');
  assert.equal(msg.enableSPA, true);
  assert.equal(typeof msg.encryptedPassword, 'string');
  assert.equal(Buffer.from(msg.encryptedPassword, 'base64').subarray(0, 4).toString(), 'HSCA');
});