import assert from 'node:assert/strict';
import test from 'node:test';
import { r2Limits, signR2Request } from './r2.js';

const settings = { account_id: 'abc123', bucket_name: 'rootminster-backups', access_key_id: 'access', secret_access_key: 'secret' };

test('R2 signing uses the Cloudflare endpoint, auto region and encoded object path', () => {
  const result = signR2Request(settings, { method: 'GET', key: 'rootminster/a file.rmbak', now: new Date('2026-09-07T12:34:56Z') });
  assert.equal(result.url, 'https://abc123.r2.cloudflarestorage.com/rootminster-backups/rootminster/a%20file.rmbak');
  assert.match(result.headers.authorization, /Credential=access\/20260907\/auto\/s3\/aws4_request/);
  assert.match(result.headers.authorization, /SignedHeaders=host;x-amz-content-sha256;x-amz-date/);
});

test('Rootminster R2 defaults retain ten percent free-tier headroom', () => {
  assert.equal(r2Limits.safeStorageBytes, r2Limits.freeStorageBytes * 0.9);
  assert.equal(r2Limits.safeClassAOperations, r2Limits.freeClassAOperations * 0.9);
  assert.equal(r2Limits.safeClassBOperations, r2Limits.freeClassBOperations * 0.9);
});
