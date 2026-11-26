import crypto from 'node:crypto';

export function oidcDiscoveryMetadata(appUrl) {
  const issuer = String(appUrl || '').replace(/\/$/, '');
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/oauth/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['openid', 'email', 'profile', 'rootminster'],
    claims_supported: ['sub', 'email', 'email_verified', 'name', 'preferred_username', 'rootminster_role', 'rootminster_status'],
  };
}

export function oidcUserInfoFromUser(user) {
  return {
    sub: String(user.id),
    email: user.email,
    email_verified: true,
    name: user.full_name || user.email,
    preferred_username: user.email,
    rootminster_role: user.role,
    rootminster_status: user.status,
  };
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function normalisePrivateKeyPem(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('-----BEGIN')) return raw.replace(/\\n/g, '\n');
  try {
    return Buffer.from(raw, 'base64').toString('utf8').replace(/\\n/g, '\n');
  } catch {
    return raw;
  }
}

export function jwksFromPrivateKey(privateKeyPem, keyId = 'rootminster-oidc') {
  const pem = normalisePrivateKeyPem(privateKeyPem);
  if (!pem) return { keys: [] };
  const jwk = crypto.createPublicKey(pem).export({ format: 'jwk' });
  return { keys: [{ ...jwk, kid: keyId, alg: 'RS256', use: 'sig', key_ops: ['verify'] }] };
}

export function signOidcIdToken({ issuer, audience, nonce = '', user, privateKeyPem, keyId = 'rootminster-oidc', now = Math.floor(Date.now() / 1000) }) {
  const pem = normalisePrivateKeyPem(privateKeyPem);
  if (!pem) throw Object.assign(new Error('OIDC signing key is not configured'), { status: 503 });
  const header = { alg: 'RS256', typ: 'JWT', kid: keyId };
  const payload = {
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + 3600,
    ...oidcUserInfoFromUser(user),
    ...(nonce ? { nonce } : {}),
  };
  const signingInput = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), pem).toString('base64url');
  return `${signingInput}.${signature}`;
}

export function scopeIncludesOpenId(scope) {
  return String(scope || '').split(/\s+/).includes('openid');
}
