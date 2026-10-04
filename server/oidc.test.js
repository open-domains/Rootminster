import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { oidcDiscoveryMetadata, oidcUserInfoFromUser, signOidcIdToken } from './oidc.js';

test('OIDC discovery advertises Rootminster endpoints for Zammad', () => {
  const metadata = oidcDiscoveryMetadata('https://open-domains.com');
  assert.equal(metadata.issuer, 'https://open-domains.com');
  assert.equal(metadata.authorization_endpoint, 'https://open-domains.com/oauth/authorize');
  assert.equal(metadata.token_endpoint, 'https://open-domains.com/oauth/token');
  assert.equal(metadata.userinfo_endpoint, 'https://open-domains.com/oauth/userinfo');
  assert.equal(metadata.jwks_uri, 'https://open-domains.com/oauth/jwks');
  assert.deepEqual(metadata.scopes_supported, ['openid', 'email', 'profile', 'rootminster']);
  assert.deepEqual(metadata.id_token_signing_alg_values_supported, ['RS256']);
});

test('OIDC userinfo exposes stable account identity and profile claims', () => {
  const claims = oidcUserInfoFromUser({ id: 'u-1', email: 'User@Example.com', full_name: 'Example User', role: 'staff', status: 'active' });
  assert.deepEqual(claims, {
    sub: 'u-1',
    email: 'User@Example.com',
    email_verified: true,
    name: 'Example User',
    preferred_username: 'User@Example.com',
    rootminster_role: 'staff',
    rootminster_status: 'active',
  });
});

test('OIDC ID token is an RS256 JWT with standard claims', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwt = signOidcIdToken({
    issuer: 'https://open-domains.com',
    audience: 'zammad-client',
    nonce: 'nonce-123',
    user: { id: 'u-1', email: 'user@example.com', full_name: 'Example User', role: 'user', status: 'active' },
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    keyId: 'test-key',
    now: 1_700_000_000,
  });
  const [headerRaw, payloadRaw, signatureRaw] = jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(headerRaw, 'base64url')).alg, 'RS256');
  assert.equal(JSON.parse(Buffer.from(headerRaw, 'base64url')).kid, 'test-key');
  const payload = JSON.parse(Buffer.from(payloadRaw, 'base64url'));
  assert.equal(payload.iss, 'https://open-domains.com');
  assert.equal(payload.aud, 'zammad-client');
  assert.equal(payload.sub, 'u-1');
  assert.equal(payload.email, 'user@example.com');
  assert.equal(payload.nonce, 'nonce-123');
  assert.equal(payload.exp, 1_700_003_600);
  assert.equal(crypto.verify('RSA-SHA256', Buffer.from(`${headerRaw}.${payloadRaw}`), publicKey, Buffer.from(signatureRaw, 'base64url')), true);
});
