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
  const ownership = design.indexOf('const { anchor, records, preview } = await inspectHostname');
  const dns = design.indexOf('for (const record of conflicts) await removeDnsRecord');
  assert.ok(ownership > -1 && dns > ownership);
});

test('Design previews replacements and publishes with GitHub Pages A and AAAA records', () => {
  assert.match(design, /api\/design-auth\/dns-preview/);
  assert.match(design, /confirmation_required: true/);
  assert.match(design, /185\.199\.108\.153/);
  assert.match(design, /2606:50c0:8000::153/);
  assert.match(design, /preserved/);
  assert.doesNotMatch(design, /type: 'CNAME', name: hostname, content: pagesHostname/);
});

test('Design uses a visible authorization page instead of automatic SSO', () => {
  assert.match(design, /Continue to Design\?/);
  assert.match(design, /app\.post\('\/api\/design-auth\/authorize'/);
});
