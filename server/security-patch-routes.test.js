import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import * as OTPAuth from 'otpauth';
import { registerFunctionRoutes } from './function-runner.js';
import { registerPublicApiRoutes } from './public-api.js';
import { store } from './store.js';
import { pool } from './database.js';
import { getModuleConfig } from './module-settings.js';
import { sha256 } from './security.js';

const RECORD_ID = '11111111-1111-4111-8111-111111111111';
const prefixes = ['/functions', '/api/functions'];
const secret = 'JBSWY3DPEHPK3PXP';
const totpCode = () => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();

// Exercise the real dispatcher, authentication, handlers and provider adapter.
// Only persistence and external HTTP are replaced; no production services run.
async function fixture(t, { user = {}, token = {} } = {}) {
  const account = { id: 'u1', email: 'owner@example.test', role: 'user', status: 'active', ...user };
  const data = {
    User: [account],
    ApiToken: [{ id: 'token', token_hash: sha256('api-secret'), user_id: account.id, user_email: account.email, scopes: ['dns:write'], ...token }],
    Domain: [{ id: 'domain', name: 'example.test', zone_id: 'zone' }],
    DnsRecord: [{ id: RECORD_ID, name: 'mine.example.test', zone_name: 'example.test', zone_id: 'zone', cloudflare_record_id: 'cf-record', owner_id: account.id, owner_email: account.email, managed: true, status: 'active', record_type: 'A', content: '8.8.8.8', ttl: 3600 }],
    SubdomainOwnership: [{ id: 'grant', full_name: 'mine.example.test', root_domain: 'example.test', owner_id: account.id, owner_email: account.email, status: 'active' }],
    SubdomainRequest: [], AuditLog: [], BlocklistEntry: [], TrustedDevice: [],
    PlatformSettings: [
      { id: 'cloudflare', key: 'module_config:cloudflare', value: JSON.stringify({ enabled: true, api_token: 'test-provider-key' }) },
      { id: 'donations', key: 'module_config:donations', value: JSON.stringify({ enabled: false }) },
    ],
  };
  const mutations = [];
  const providerCalls = [];
  const sqlWrites = [];
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => row[key] === value);
  t.mock.method(store, 'filter', async (entity, filter, _sort, limit = 1000, skip = 0) => structuredClone((data[entity] || []).filter(row => matches(row, filter)).slice(skip, skip + limit)));
  t.mock.method(store, 'list', async (entity, _sort, limit = 1000, skip = 0) => structuredClone((data[entity] || []).slice(skip, skip + limit)));
  t.mock.method(store, 'get', async (entity, id) => structuredClone((data[entity] || []).find(row => row.id === id) || null));
  t.mock.method(store, 'update', async (entity, id, patch) => {
    mutations.push({ entity, id, patch });
    const row = data[entity].find(item => item.id === id);
    assert.ok(row, `Missing fixture ${entity}/${id}`);
    Object.assign(row, patch);
    return structuredClone(row);
  });
  t.mock.method(store, 'create', async (entity, value) => {
    mutations.push({ entity, value });
    const row = { ...value, id: `${entity}-${data[entity].length + 1}` };
    data[entity].push(row);
    return structuredClone(row);
  });
  t.mock.method(store, 'delete', async (entity, id) => {
    mutations.push({ entity, id, deleted: true });
    const index = data[entity].findIndex(row => row.id === id);
    assert.notEqual(index, -1);
    return data[entity].splice(index, 1)[0];
  });
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM sessions s JOIN users')) {
      return { rows: params[0] === sha256('browser-session') && account.status === 'active'
        ? [{ ...account, _session_id: 'session', _passkey_enabled: Boolean(account.passkey_enabled), _session_mfa_verified_at: account.mfa_verified ? new Date() : null }] : [] };
    }
    assert.match(sql, /^UPDATE sessions SET /);
    sqlWrites.push({ sql, params });
    return { rows: [] };
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(String(url), /^https:\/\/api\.cloudflare\.com\/client\/v4\/zones\/zone\/dns_records/);
    const payload = options.body ? JSON.parse(options.body) : {};
    providerCalls.push({ url, method: options.method, payload });
    return Response.json({ success: true, result: { id: 'cf-result', ...payload } });
  });
  await getModuleConfig('cloudflare', { fresh: true });
  await getModuleConfig('donations', { fresh: true });
  const app = Fastify();
  await registerFunctionRoutes(app);
  await registerPublicApiRoutes(app);
  t.after(() => app.close());
  return { app, data, account, mutations, providerCalls, sqlWrites };
}

const apiTargets = [
  ...prefixes.map(prefix => ({ url: `${prefix}/publicApi`, method: 'POST', payload: { action: 'update', dns_record_id: RECORD_ID, new_content: '1.1.1.1' } })),
  { url: `/api/v1/dns/records/${RECORD_ID}`, method: 'PATCH', payload: { content: '1.1.1.1' } },
];

for (const target of apiTargets) {
  for (const [name, options, status] of [
    ['expired', { token: { expires_at: '2000-01-01T00:00:00Z' } }, 401],
    ['invalid expiry', { token: { expires_at: 'invalid' } }, 401],
    ['revoked', { token: { revoked: true } }, 401],
    ['disabled account', { user: { status: 'disabled' } }, 401],
    ['unverified account', { user: { status: 'pending' } }, 401],
    ['missing owner', { token: { user_id: 'missing' } }, 401],
    ['read-only', { token: { scopes: ['account:read'] } }, 403],
    ['DDNS-only', { token: { scopes: ['dns:dynamic'] } }, 403],
    ['wrong hostname', { token: { allowed_hostnames: ['elsewhere.example.test'] } }, 403],
    ['wrong record type', { token: { allowed_record_types: ['TXT'] } }, 403],
  ]) {
    test(`${target.url} rejects ${name} without DNS side effects`, async t => {
      const f = await fixture(t, options);
      const response = await f.app.inject({ ...target, headers: { authorization: 'Bearer api-secret' } });
      assert.equal(response.statusCode, status, response.body);
      assert.equal(f.providerCalls.length, 0);
      assert.equal(f.mutations.filter(item => item.entity !== 'ApiToken').length, 0);
    });
  }
  for (const [name, token] of [
    ['scoped', { allowed_hostnames: ['MINE.EXAMPLE.TEST.'], allowed_record_types: ['a'], expires_at: '2099-01-01T00:00:00Z' }],
    ['legacy unscoped', { scopes: undefined, user_id: undefined }],
  ]) {
    test(`${target.url} accepts a valid ${name} token and updates the owned record`, async t => {
      const f = await fixture(t, { token });
      const response = await f.app.inject({ ...target, headers: { authorization: 'bearer api-secret' } });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(f.providerCalls.length, 1);
      assert.equal(f.providerCalls[0].method, 'PUT');
      assert.equal(f.data.DnsRecord[0].content, '1.1.1.1');
    });
  }
}

for (const prefix of prefixes) {
  test(`${prefix} cannot substitute a browser session for an API token`, async t => {
    const f = await fixture(t);
    const response = await f.app.inject({ method: 'POST', url: `${prefix}/publicApi`, headers: { authorization: 'Bearer browser-session' }, payload: apiTargets[0].payload });
    assert.equal(response.statusCode, 401);
    assert.equal(f.providerCalls.length, 0);
  });
  for (const [name, token, role, status] of [
    ['no staff scope', { scopes: ['dns:read'] }, 'staff', 403],
    ['unscoped staff token', { scopes: [] }, 'staff', 403],
    ['non-staff owner', { scopes: ['staff:read'] }, 'user', 403],
    ['authorized staff token', { scopes: ['staff:read'] }, 'staff', 200],
  ]) {
    test(`${prefix} WHOIS: ${name}`, async t => {
      const f = await fixture(t, { user: { role }, token });
      const response = await f.app.inject({ url: `${prefix}/publicApi?action=whois&subdomain=mine&domain=example.test`, headers: { authorization: 'Bearer api-secret' } });
      assert.equal(response.statusCode, status, response.body);
    });
  }
  test(`${prefix} account details require account:read`, async t => {
    const f = await fixture(t);
    const request = { url: `${prefix}/publicApi?action=me`, headers: { authorization: 'Bearer api-secret' } };
    assert.equal((await f.app.inject(request)).statusCode, 403);
    f.data.ApiToken[0].scopes = ['account:read'];
    assert.equal((await f.app.inject(request)).statusCode, 200);
    f.account.status = 'disabled';
    assert.equal((await f.app.inject(request)).statusCode, 401);
  });

  for (const base of ['example.test', 'test', 'other.example.test']) {
    test(`${prefix} DNS deletion cannot promote ownership using base_name=${base}`, async t => {
      const f = await fixture(t);
      const response = await f.app.inject({ method: 'POST', url: `${prefix}/manageDnsRecord`, headers: { authorization: 'Bearer browser-session' }, payload: { action: 'delete', record_id: RECORD_ID, base_name: base } });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(f.data.DnsRecord.length, 0);
      assert.deepEqual(f.data.SubdomainOwnership.map(row => [row.full_name, row.status]), [['mine.example.test', 'suspended']]);
      f.data.DnsRecord.push({ id: 'victim-record', name: 'someone-else.example.test', owner_id: 'victim', record_type: 'A', content: '8.8.4.4', status: 'active' });
      const attack = await f.app.inject({ method: 'POST', url: `${prefix}/manageDnsRecord`, headers: { authorization: 'Bearer browser-session' }, payload: { action: 'create', name: 'someone-else.example.test', record_type: 'TXT', content: 'verification-token' } });
      assert.equal(attack.statusCode, 403, attack.body);
      assert.deepEqual(f.providerCalls.map(call => call.method), ['DELETE']);
      // The empty namespace remains usable by its rightful owner.
      const restore = await f.app.inject({ method: 'POST', url: `${prefix}/manageDnsRecord`, headers: { authorization: 'Bearer browser-session' }, payload: { action: 'create', name: 'nested.mine.example.test', record_type: 'A', content: '1.1.1.1' } });
      assert.equal(restore.statusCode, 200, restore.body);
      assert.equal(f.data.SubdomainOwnership[0].status, 'active');
    });
  }

  for (const role of ['user', 'staff', 'admin']) {
    for (const action of ['setup', 'enable']) {
      test(`${prefix} ${role} cannot ${action} TOTP while passkey MFA is pending`, async t => {
        const f = await fixture(t, { user: { role, passkey_enabled: true, mfa_verified: false } });
        const response = await f.app.inject({ method: 'POST', url: `${prefix}/twoFactorAuth`, headers: { authorization: 'Bearer browser-session' }, payload: { action, secret, code: totpCode() } });
        assert.equal(response.statusCode, 403, response.body);
        assert.equal(f.mutations.length, 0);
        assert.equal(f.sqlWrites.some(item => item.sql.includes('mfa_verified_at = now()')), false);
      });
    }
    test(`${prefix} ${role} can bootstrap TOTP when no factor is enrolled`, async t => {
      const f = await fixture(t, { user: { role } });
      const response = await f.app.inject({ method: 'POST', url: `${prefix}/twoFactorAuth`, headers: { authorization: 'Bearer browser-session' }, payload: { action: 'enable', secret, code: totpCode() } });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(f.account.totp_enabled, true);
      assert.equal(f.sqlWrites.some(item => item.sql.includes('mfa_verified_at = now()')), true);
    });
  }
  test(`${prefix} a verified passkey session can add TOTP`, async t => {
    const f = await fixture(t, { user: { passkey_enabled: true, mfa_verified: true } });
    const response = await f.app.inject({ method: 'POST', url: `${prefix}/twoFactorAuth`, headers: { authorization: 'Bearer browser-session' }, payload: { action: 'enable', secret, code: totpCode() } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(f.account.totp_enabled, true);
  });
  test(`${prefix} pending sessions can still verify their existing TOTP`, async t => {
    const f = await fixture(t, { user: { totp_enabled: true, totp_secret: secret } });
    const response = await f.app.inject({ method: 'POST', url: `${prefix}/twoFactorAuth`, headers: { authorization: 'Bearer browser-session' }, payload: { action: 'verify', code: totpCode() } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(f.sqlWrites.some(item => item.sql.includes('mfa_verified_at = now()')), true);
  });
}

for (const url of [...prefixes.map(prefix => `${prefix}/publicApi`), '/api/v1/requests']) {
  for (const [name, token, records] of [
    ['wrong scope', { scopes: ['account:read'] }, [{ record_type: 'A' }]],
    ['wrong hostname', { allowed_hostnames: ['elsewhere.example.test'] }, [{ record_type: 'A' }]],
    ['restricted bundle member', { allowed_record_types: ['A'] }, [{ record_type: 'A' }, { record_type: 'TXT' }]],
  ]) {
    test(`${url} refuses submission with ${name}`, async t => {
      const f = await fixture(t, { token: { scopes: ['requests:write'], ...token } });
      const response = await f.app.inject({ method: 'POST', url, headers: { authorization: 'Bearer api-secret' }, payload: { action: 'submit', subdomain: 'mine', root_domain: 'example.test', records } });
      assert.equal(response.statusCode, 403, response.body);
      assert.equal(f.data.SubdomainRequest.length, 0);
      assert.equal(f.providerCalls.length, 0);
    });
  }
}
