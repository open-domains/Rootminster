import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  COOKIE_CONSENT_MAX_AGE,
  COOKIE_CONSENT_VERSION,
  parseConsentValue,
  serializeConsentValue,
} from '../src/lib/cookie-consent.js';

test('cookie consent preferences round-trip without losing the decision', () => {
  const updatedAt = '2026-09-09T12:00:00.000Z';
  assert.deepEqual(parseConsentValue(serializeConsentValue({ analytics: true }, updatedAt)), {
    version: COOKIE_CONSENT_VERSION,
    analytics: true,
    updated_at: updatedAt,
  });
  assert.equal(COOKIE_CONSENT_MAX_AGE, 15_552_000);
});

test('invalid and obsolete consent values require a new choice', () => {
  assert.equal(parseConsentValue('%7Bbroken'), null);
  assert.equal(parseConsentValue(encodeURIComponent(JSON.stringify({ version: 'old', analytics: true }))), null);
  assert.equal(parseConsentValue(encodeURIComponent(JSON.stringify({ version: COOKIE_CONSENT_VERSION, analytics: 'yes' }))), null);
});

test('analytics is not loaded by the initial HTML document', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /googletagmanager\.com|analytics\.open-domains\.com|analytics-bootstrap/);

  const loader = readFileSync(new URL('../src/lib/consent-analytics.js', import.meta.url), 'utf8');
  assert.match(loader, /readCookieConsent\(\)\?\.analytics/);
});
