import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeRequestPath, matchesBlockedPrefix } from './impersonation-routes.js';

test('security-sensitive routes are blocked during impersonation', () => {
  assert.ok(matchesBlockedPrefix('/api/auth/tokens'));
  assert.ok(matchesBlockedPrefix('/api/auth/tokens/abc123'));
  assert.ok(matchesBlockedPrefix('/api/auth/passkeys/register/options'));
  assert.ok(matchesBlockedPrefix('/api/functions/twoFactorAuth'));
  assert.ok(matchesBlockedPrefix('/functions/twoFactorAuth'));
  assert.ok(matchesBlockedPrefix('/api/account-deletion-request'));
});

test('Discord account linking is blocked during impersonation', () => {
  // Linking a Discord identity binds a lasting login to the account, so it must
  // not be reachable while an admin is viewing as another user.
  assert.ok(matchesBlockedPrefix('/api/discord/link'));
});

test('unrelated routes are not blocked', () => {
  assert.equal(matchesBlockedPrefix('/api/auth/me'), false);
  assert.equal(matchesBlockedPrefix('/api/entities/SubdomainRequest'), false);
  assert.equal(matchesBlockedPrefix('/api/discord/linkage'), false);
  assert.equal(matchesBlockedPrefix(undefined), false);
});

test('percent-encoded paths decode to the real route before matching', () => {
  // Fastify decodes before routing, so /api/auth/%74okens reaches the token
  // handler; the blocklist must see the decoded form, not the raw URL.
  assert.equal(decodeRequestPath('/api/auth/%74okens'), '/api/auth/tokens');
  assert.ok(matchesBlockedPrefix(decodeRequestPath('/api/auth/%74okens')));
  assert.ok(matchesBlockedPrefix(decodeRequestPath('/api/auth/%74okens?x=1')));
  // Double-encoding must not slip past either.
  assert.ok(matchesBlockedPrefix(decodeRequestPath('/api/auth/%2574okens')));
});

test('decodeRequestPath strips the query string and tolerates malformed escapes', () => {
  assert.equal(decodeRequestPath('/api/auth/tokens?foo=bar'), '/api/auth/tokens');
  assert.equal(decodeRequestPath('/api/auth/%zztokens'), '/api/auth/%zztokens');
  assert.equal(decodeRequestPath(''), '');
  assert.equal(decodeRequestPath(undefined), '');
});
