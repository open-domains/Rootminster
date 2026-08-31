import assert from 'node:assert/strict';
import test from 'node:test';
import { assessDeterministic, parseProtectedBrands, SAFETY_RULESET_VERSION } from './lib/safety-screening.js';

const establishedUser = { id: 'user-1', created_date: '2025-01-01T00:00:00.000Z' };
const now = '2026-08-31T12:00:00.000Z';

test('clean requests remain clear and explain their ruleset', () => {
  const result = assessDeterministic({
    subdomain: 'weather-station',
    record_type: 'CNAME',
    reason: 'A community weather dashboard',
    preview_link: 'https://weather.example.org/demo',
  }, { user: establishedUser, now, recentRequests: [], protectedBrands: [] });
  assert.equal(result.score, 0);
  assert.equal(result.verdict, 'clear');
  assert.equal(result.ruleset_version, SAFETY_RULESET_VERSION);
  assert.deepEqual(result.signals, []);
});

test('multiple transparent signals produce a high-risk verdict', () => {
  const result = assessDeterministic({
    subdomain: 'cloudflare-login-verify',
    record_type: 'MX',
    reason: 'secure account verification',
    preview_link: 'http://127.0.0.1/login',
  }, {
    user: { created_date: '2026-08-31T10:00:00.000Z' },
    now,
    recentRequests: [],
    protectedBrands: 'cloudflare',
  });
  assert.equal(result.score, 100);
  assert.equal(result.verdict, 'high_risk');
  assert.ok(result.signals.some((item) => item.code === 'protected_brand'));
  assert.ok(result.signals.some((item) => item.code === 'private_preview_host'));
  assert.ok(result.signals.some((item) => item.code === 'new_account_sensitive_record'));
});

test('request history contributes velocity and rejection signals', () => {
  const recentRequests = Array.from({ length: 5 }, (_, index) => ({
    id: `request-${index}`,
    created_date: `2026-08-31T11:${String(index).padStart(2, '0')}:00.000Z`,
    status: index < 3 ? 'rejected' : 'pending',
  }));
  const result = assessDeterministic({
    subdomain: 'project', record_type: 'A', reason: 'A test project', preview_link: 'https://example.org',
  }, { user: establishedUser, now, recentRequests });
  assert.equal(result.score, 45);
  assert.equal(result.verdict, 'review');
  assert.ok(result.signals.some((item) => item.code === 'request_velocity_hour'));
  assert.ok(result.signals.some((item) => item.code === 'prior_rejections'));
});

test('protected brand configuration is normalised and deduplicated', () => {
  assert.deepEqual(parseProtectedBrands('Cloudflare\nopen-domains,cloudflare\nnot valid!'), ['cloudflare', 'open-domains']);
});
