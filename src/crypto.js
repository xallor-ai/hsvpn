'use strict';

const crypto = require('crypto');

/** From Hillstone Secure Connect client reverse engineering. */
const AES_KEY = Buffer.from('2022@hsclnt@2022abc@123@??#2@HIL', 'utf8');
const AES_IV = Buffer.from('FR22089R10202212', 'utf8');

/**
 * Build HSC encryptedPassword payload:
 * Base64( HSCA + "0" + NUL + AES-256-CBC(PKCS7, plaintext_password) )
 */
function encryptPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('password must be a non-empty string');
  }
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const blob = Buffer.concat([
    Buffer.from('HSCA', 'ascii'),
    Buffer.from([0x30, 0x00]),
    enc,
  ]);
  return blob.toString('base64');
}

module.exports = { encryptPassword, AES_KEY, AES_IV };