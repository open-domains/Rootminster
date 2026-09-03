import assert from 'node:assert/strict';
import test from 'node:test';
import { contentSecurityPolicy, CSP_SCRIPT_HASHES } from './csp.js';

test('CSP permits required analytics and Turnstile resources without unsafe inline scripts', () => {
  assert.ok(contentSecurityPolicy.scriptSrc.includes('https://analytics.open-domains.com'));
  assert.ok(contentSecurityPolicy.scriptSrc.includes('https://www.googletagmanager.com'));
  assert.ok(contentSecurityPolicy.scriptSrc.includes('https://challenges.cloudflare.com'));
  assert.ok(contentSecurityPolicy.frameSrc.includes('https://challenges.cloudflare.com'));
  assert.ok(contentSecurityPolicy.connectSrc.includes('https://www.google-analytics.com'));
  assert.equal(contentSecurityPolicy.scriptSrc.includes("'unsafe-inline'"), false);
  assert.equal(contentSecurityPolicy.scriptSrcAttr.includes("'unsafe-inline'"), false);
  assert.equal(CSP_SCRIPT_HASHES.length, 0);
});
