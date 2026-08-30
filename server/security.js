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
