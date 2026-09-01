import crypto from 'node:crypto';
import argon2 from 'argon2';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
export const timingSafeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export function sixDigitCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 3,
    parallelism: 1,
  });
}

export function verifyPassword(hash, password) {
  return hash ? argon2.verify(hash, password) : false;
}

function totpEncryptionKey() {
  const source = process.env.TOTP_ENCRYPTION_KEY || '';
  return source ? crypto.createHash('sha256').update(source).digest() : null;
}

function moduleEncryptionKey() {
  const source = process.env.MODULE_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY || '';
  return source ? crypto.createHash('sha256').update(`rootminster-modules:${source}`).digest() : null;
}

function encryptWithKey(value, key) {
  if (!key) throw Object.assign(new Error('Module encryption is not configured'), { status: 503 });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptWithKey(value, key) {
  if (!key) throw Object.assign(new Error('Module encryption is not configured'), { status: 503 });
  const [, , iv, tag, encrypted] = String(value).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

export const encryptSettingSecret = (value) => encryptWithKey(value, moduleEncryptionKey());
export const decryptSettingSecret = (value) => decryptWithKey(value, moduleEncryptionKey());

export function encryptTotpSecret(secret) {
  const key = totpEncryptionKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('TOTP encryption is not configured'), { status: 503 });
    return String(secret || '');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptTotpSecret(value) {
  const stored = String(value || '');
  if (!stored.startsWith('enc:v1:')) return stored;
  const key = totpEncryptionKey();
  if (!key) throw Object.assign(new Error('TOTP encryption is not configured'), { status: 503 });
  const [, , iv, tag, encrypted] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}
