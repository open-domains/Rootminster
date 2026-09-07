import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('RMBACK01');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;

function encryptionSecret() {
  return process.env.BACKUP_ENCRYPTION_KEY || process.env.MODULE_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY || '';
}

export function backupEncryptionConfigured() {
  return encryptionSecret().length >= 16;
}

function deriveKey(salt) {
  const secret = encryptionSecret();
  if (secret.length < 16) {
    throw Object.assign(new Error('Configure BACKUP_ENCRYPTION_KEY or a strong MODULE_ENCRYPTION_KEY before creating backups'), { status: 503 });
  }
  return crypto.scryptSync(secret, salt, 32, { N: 16384, r: 8, p: 1 });
}

export async function encryptBackup(sourcePath, destinationPath) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(salt), iv);
  const output = createWriteStream(destinationPath, { flags: 'wx', mode: 0o600 });
  output.write(Buffer.concat([MAGIC, salt, iv]));
  await pipeline(createReadStream(sourcePath), cipher, output);
  await open(destinationPath, 'a').then(async (file) => {
    try { await file.write(cipher.getAuthTag()); } finally { await file.close(); }
  });
}

export async function decryptBackup(sourcePath, destinationPath) {
  const details = await stat(sourcePath);
  if (details.size <= HEADER_BYTES + TAG_BYTES) throw new Error('Backup archive is truncated');
  const file = await open(sourcePath, 'r');
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    await file.read(header, 0, HEADER_BYTES, 0);
    await file.read(tag, 0, TAG_BYTES, details.size - TAG_BYTES);
    if (!crypto.timingSafeEqual(header.subarray(0, MAGIC.length), MAGIC)) throw new Error('Unsupported backup archive format');
    const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
    const iv = header.subarray(MAGIC.length + SALT_BYTES, HEADER_BYTES);
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(salt), iv);
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(sourcePath, { start: HEADER_BYTES, end: details.size - TAG_BYTES - 1 }),
      decipher,
      createWriteStream(destinationPath, { flags: 'wx', mode: 0o600 }),
    );
  } finally {
    await file.close();
  }
}

export async function sha256File(path) {
  const hash = crypto.createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

export const backupArchiveFormat = Object.freeze({ magic: MAGIC.toString('ascii'), version: 1 });
