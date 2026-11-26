import assert from 'node:assert/strict';
import test from 'node:test';
import { disposableEmailResult, DISPOSABLE_EMAIL_SOURCE_URL, parseDisposableDomains } from '../../server/lib/disposable-email.js';

test('detects disposable domains from the configured source and administrator list', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, DISPOSABLE_EMAIL_SOURCE_URL);
    return { ok: true, json: async () => ['mailinator.com', 'source-only.example'] };
  };
  try {
    assert.equal((await disposableEmailResult('person@mailinator.com', { enabled: true })).disposable, true);
    assert.equal((await disposableEmailResult('person@source-only.example', { enabled: true })).disposable, true);
    assert.equal((await disposableEmailResult('person@example.com', { enabled: true, additional_domains: 'throw.test, blocked.example' })).disposable, false);
    assert.equal((await disposableEmailResult('person@blocked.example', { enabled: true, additional_domains: 'throw.test, blocked.example' })).disposable, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not enforce disposable detection while the module is disabled', async () => {
  assert.equal((await disposableEmailResult('person@mailinator.com', { enabled: false })).disposable, false);
  assert.deepEqual([...parseDisposableDomains('@one.example; two.example')], ['one.example', 'two.example']);
});

test('detects disposable subdomains by checking root domain', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ['dns.army', 'dynipv6.de'],
  });
  const settings = { enabled: true, source_url: 'https://example.com/disposable-subdomain-test.json' };
  try {
    // subdomain of a blocked root — should be caught
    assert.equal((await disposableEmailResult('user@pjjlxwbykk.dns.army', settings)).disposable, true);
    assert.equal((await disposableEmailResult('user@abc123.dynipv6.de', settings)).disposable, true);
    // deeply nested subdomain — should still be caught
    assert.equal((await disposableEmailResult('user@a.b.dynipv6.de', settings)).disposable, true);
    // root domain itself — still caught
    assert.equal((await disposableEmailResult('user@dynipv6.de', settings)).disposable, true);
    // unrelated domain — should not be caught
    assert.equal((await disposableEmailResult('user@example.com', settings)).disposable, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
