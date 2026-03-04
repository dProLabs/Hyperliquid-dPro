import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { SkillError, ErrorCode } from '../errors.mjs';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(password, salt) {
  return scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}

/**
 * Encrypt data with AES-256-GCM using a password.
 * Returns: salt(16) + iv(12) + tag(16) + ciphertext as hex string.
 */
export function encrypt(plaintext, password) {
  try {
    const salt = randomBytes(SALT_LENGTH);
    const key = deriveKey(password, salt);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
  } catch (err) {
    throw new SkillError(ErrorCode.ENCRYPTION_ERROR, `Encryption failed: ${err.message}`);
  }
}

/**
 * Decrypt hex-encoded ciphertext produced by encrypt().
 */
export function decrypt(hexCiphertext, password) {
  try {
    const buf = Buffer.from(hexCiphertext, 'hex');
    const salt = buf.subarray(0, SALT_LENGTH);
    const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const key = deriveKey(password, salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch (err) {
    if (err.code === ErrorCode.ENCRYPTION_ERROR) throw err;
    throw new SkillError(ErrorCode.ENCRYPTION_ERROR, 'Decryption failed: wrong password or corrupted data.');
  }
}
