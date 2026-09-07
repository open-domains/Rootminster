import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { backupEncryptionConfigured, decryptBackup, encryptBackup, sha256File } from './backup-crypto.js';

test('encrypts and authenticates a backup archive', async () => {
  const previous = process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_ENCRYPTION_KEY = 'unit-test-recovery-key-that-is-not-used-in-production';
  const directory = await mkdtemp(join(tmpdir(), 'rootminster-backup-test-'));
  try {
    const source = join(directory, 'source.dump');
    const encrypted = join(directory, 'backup.rmbak');
    const restored = join(directory, 'restored.dump');
    await writeFile(source, Buffer.from('postgres custom dump test data\n'.repeat(100)));
    assert.equal(backupEncryptionConfigured(), true);
    await encryptBackup(source, encrypted);
    assert.notDeepEqual(await readFile(encrypted), await readFile(source));
    assert.match(await sha256File(encrypted), /^[a-f0-9]{64}$/);
    await decryptBackup(encrypted, restored);
    assert.deepEqual(await readFile(restored), await readFile(source));
  } finally {
    if (previous === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects an archive modified after encryption', async () => {
  const previous = process.env.BACKUP_ENCRYPTION_KEY;
  process.env.BACKUP_ENCRYPTION_KEY = 'unit-test-recovery-key-that-is-not-used-in-production';
  const directory = await mkdtemp(join(tmpdir(), 'rootminster-backup-test-'));
  try {
    const source = join(directory, 'source.dump');
    const encrypted = join(directory, 'backup.rmbak');
    await writeFile(source, 'sensitive database contents');
    await encryptBackup(source, encrypted);
    const tampered = await readFile(encrypted);
    tampered[40] ^= 1;
    await writeFile(encrypted, tampered);
    await assert.rejects(() => decryptBackup(encrypted, join(directory, 'restored.dump')));
  } finally {
    if (previous === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
