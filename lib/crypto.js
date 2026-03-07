/**
 * lib/crypto.js — AES-256-GCM encryption for private keys
 *
 * Format: hex(iv):hex(authTag):hex(ciphertext)
 * Key:    WALLET_ENCRYPTION_KEY env var (32-byte hex = 64 chars)
 */
'use strict';
const crypto = require('crypto');

const ALGO     = 'aes-256-gcm';
const KEY_HEX  = process.env.WALLET_ENCRYPTION_KEY || '';
const KEY      = KEY_HEX ? Buffer.from(KEY_HEX, 'hex') : null;

function getKey() {
  if (!KEY || KEY.length !== 32) throw new Error('WALLET_ENCRYPTION_KEY missing or invalid (must be 32-byte hex)');
  return KEY;
}

/**
 * Encrypt a string (e.g. private key).
 * Returns: "iv:authTag:ciphertext" (all hex)
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv  = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string encrypted by encrypt().
 * Returns original plaintext.
 */
function decrypt(ciphertext) {
  if (!ciphertext) return null;
  // Legacy: if not in iv:authTag:data format, return as-is (plain key stored before encryption)
  if (!ciphertext.includes(':')) return ciphertext;
  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // legacy plain key
  const key     = getKey();
  const iv      = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const data    = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
