import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const design = await readFile(new URL('./design.js', import.meta.url), 'utf8');
const modules = await readFile(new URL('./module-settings.js', import.meta.url), 'utf8');
const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

test('Design integration is disabled by default and starts admin-only', () => {
  assert.match(modules, /design:\s*\{/);
  assert.match(modules, /defaultEnabled: false/);
  assert.match(modules, /admins_only: true/);
});

test('Design authorization codes use PKCE and are single-use and short-lived', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS design_auth_codes/);
  assert.match(design, /DELETE FROM design_auth_codes/);
  assert.match(design, /pkce\(body\.code_verifier\)/);
  assert.match(design, /interval '60 seconds'/);
});

test('Design publishing verifies ownership before changing DNS', () => {
  const ownership = design.indexOf('const record = await ownedRecord');
  const dns = design.indexOf('/dns_records/${record.cloudflare_record_id}`');
  assert.ok(ownership > -1 && dns > ownership);
});

test('Design uses a visible authorization page instead of automatic SSO', () => {
  assert.match(design, /Continue to Design\?/);
  assert.match(design, /app\.post\('\/api\/design-auth\/authorize'/);
});
