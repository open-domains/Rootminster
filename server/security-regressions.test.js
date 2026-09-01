import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decryptSettingSecret, decryptTotpSecret, encryptSettingSecret, encryptTotpSecret } from './security.js';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('TOTP secrets encrypt with authenticated encryption when configured', () => {
  const previous = process.env.TOTP_ENCRYPTION_KEY;
  process.env.TOTP_ENCRYPTION_KEY = 'test-only-encryption-key-with-enough-entropy';
  try {
    const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP');
    assert.match(encrypted, /^enc:v1:/);
    assert.notEqual(encrypted, 'JBSWY3DPEHPK3PXP');
    assert.equal(decryptTotpSecret(encrypted), 'JBSWY3DPEHPK3PXP');
    const parts = encrypted.split(':');
    parts[3] = `${parts[3][0] === 'A' ? 'B' : 'A'}${parts[3].slice(1)}`;
    assert.throws(() => decryptTotpSecret(parts.join(':')));
  } finally {
    if (previous === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = previous;
  }
});

test('module secrets use a separate authenticated-encryption key domain', () => {
  const previous = process.env.MODULE_ENCRYPTION_KEY;
  process.env.MODULE_ENCRYPTION_KEY = 'test-only-module-key-with-enough-entropy';
  try {
    const encrypted = encryptSettingSecret('sk_live_not-a-real-secret');
    assert.match(encrypted, /^enc:v1:/);
    assert.equal(decryptSettingSecret(encrypted), 'sk_live_not-a-real-secret');
    assert.notEqual(encrypted, encryptSettingSecret('sk_live_not-a-real-secret'));
  } finally {
    if (previous === undefined) delete process.env.MODULE_ENCRYPTION_KEY;
    else process.env.MODULE_ENCRYPTION_KEY = previous;
  }
});

test('browser sessions carry server-side MFA assurance', async () => {
  const auth = await source('./auth.js');
  assert.match(auth, /s\.mfa_verified_at AS _session_mfa_verified_at/);
  assert.match(auth, /if \(!mfaVerified && !allowMfaPending\) return null/);
  assert.match(auth, /UPDATE sessions SET mfa_verified_at = now\(\)/);
});

test('scheduled jobs are not exposed through the HTTP function dispatcher', async () => {
  const runner = await source('./function-runner.js');
  assert.match(runner, /HTTP_FUNCTION_NAMES\.delete\(internalOnly\)/);
  assert.match(runner, /cleanupPendingDonations.*scheduledSync.*weeklyStatsDiscord/s);
  assert.doesNotMatch(runner, /method:\s*\['GET',\s*'POST'/);
});

test('DNS mutation never treats an API-token row ID as a credential', async () => {
  const manager = await source('./functions/manageDnsRecord.js');
  assert.doesNotMatch(manager, /body\.api_token_id/);
  assert.doesNotMatch(manager, /ApiToken\.filter\(\{ id:/);
});

test('comments authorize the target before creating a comment', async () => {
  const comments = await source('./functions/postComment.js');
  const ownershipCheck = comments.indexOf('if (!elevated && !ownsRequest)');
  const createComment = comments.indexOf('RequestComment.create');
  assert.ok(ownershipCheck > 0);
  assert.ok(createComment > ownershipCheck);
});

test('TOTP enrollment does not disclose its seed to a QR service', async () => {
  const setup = await readFile(new URL('../src/components/TwoFactorSetup.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(setup, /api\.qrserver\.com/);
  assert.doesNotMatch(setup, /encodeURIComponent\(uri\)/);
});
