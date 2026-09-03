import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEnvelopeEndpoint, scrubServerEvent } from './glitchtip.js';

test('builds a GlitchTip envelope endpoint from a project DSN', () => {
  assert.equal(
    buildEnvelopeEndpoint('https://public-key@errors.example.com/sentry/42'),
    'https://errors.example.com/sentry/api/42/envelope/?sentry_key=public-key&sentry_version=7',
  );
  assert.throws(() => buildEnvelopeEndpoint('https://errors.example.com/not-a-project'));
});

test('removes request and user data from server events', () => {
  const event = scrubServerEvent({
    user: { email: 'private@example.com' },
    request: { url: 'https://example.com/reset?token=secret', headers: { authorization: 'secret' }, cookies: { session: 'secret' }, data: 'secret' },
  });
  assert.equal(event.user, undefined);
  assert.deepEqual(event.request, { url: 'https://example.com/reset' });
});
