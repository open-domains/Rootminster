import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { registerEntityRoutes } from './entity-routes.js';
import rdapLookup from './functions/rdapLookup.js';
import { bindRequestActor } from './lib/platform-client.js';
import { store } from './store.js';
import { pool } from './database.js';
import { sha256 } from './security.js';

const STAFF_FIELDS = {
  admin_notes: 'Looks like phishing, watch this account',
  safety_score: 82,
  safety_verdict: 'review',
  safety_override_reason: 'Brand match',
  observer_status: 'flagged',
  observer_score: 71,
};

async function entityFixture(t, role) {
  const account = { id: 'u1', email: 'owner@example.test', role, status: 'active' };
  const data = {
    SubdomainRequest: [{ id: 'req', requester_id: 'u1', requester_email: account.email, subdomain: 'site', root_domain: 'example.test', status: 'pending', rejection_reason: '', ...STAFF_FIELDS }],
    EditRequest: [{ id: 'edit', requester_id: 'u1', requester_email: account.email, status: 'pending', admin_notes: 'internal' }],
  };
  const filters = [];
  t.mock.method(store, 'filter', async (entity, filter, sort) => {
    filters.push({ filter, sort });
    return structuredClone((data[entity] || []).filter(row => Object.entries(filter).every(([key, value]) => row[key] === value)));
  });
  t.mock.method(store, 'get', async (entity, id) => structuredClone((data[entity] || []).find(row => row.id === id) || null));
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM sessions s JOIN users')) {
      return { rows: params[0] === sha256('browser-session') ? [{ ...account, _session_id: 'session', _session_mfa_verified_at: new Date() }] : [] };
    }
    return { rows: [] };
  });
  const app = Fastify();
  await registerEntityRoutes(app);
  t.after(() => app.close());
  const get = url => app.inject({ url, headers: { authorization: 'Bearer browser-session' } });
  return { get, filters };
}

test('requesters cannot read staff notes or screening results on their own requests', async t => {
  const f = await entityFixture(t, 'user');
  for (const url of ['/api/entities/SubdomainRequest', '/api/entities/SubdomainRequest/req', '/api/entities/EditRequest', '/api/entities/EditRequest/edit']) {
    const response = await f.get(url);
    assert.equal(response.statusCode, 200, response.body);
    const body = JSON.parse(response.body).data;
    const rows = Array.isArray(body) ? body : [body];
    assert.equal(rows.length, 1, url);
    for (const key of Object.keys(STAFF_FIELDS)) assert.equal(key in rows[0], false, `${url} leaked ${key}`);
    assert.equal(rows[0].status, 'pending');
  }
});

test('requesters cannot filter or sort on staff-only request fields', async t => {
  const f = await entityFixture(t, 'user');
  const filter = encodeURIComponent(JSON.stringify({ status: 'pending', safety_verdict: 'review', admin_notes: 'x' }));
  const response = await f.get(`/api/entities/SubdomainRequest?filter=${filter}&sort=-safety_score`);
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(f.filters.at(-1), { filter: { status: 'pending' }, sort: undefined });
});

test('staff still see review notes and screening results', async t => {
  const f = await entityFixture(t, 'staff');
  const response = await f.get('/api/entities/SubdomainRequest/req');
  const row = JSON.parse(response.body).data;
  for (const [key, value] of Object.entries(STAFF_FIELDS)) assert.deepEqual(row[key], value);
});

function rdapRequest(domain) {
  return bindRequestActor(new Request('https://example.test/function', { method: 'POST', body: JSON.stringify({ domain }) }), null);
}

test('RDAP resolves a subdomain with one domain query', async t => {
  const queries = [];
  t.mock.method(store, 'filter', async (entity, filter) => {
    queries.push({ entity, filter });
    if (entity === 'Domain') return [{ id: 'd', name: 'is-cool.dev', status: 'active' }].filter(row => filter.name.$in.includes(row.name));
    return [];
  });
  const response = await rdapLookup(rdapRequest('Migration.Is-Cool.dev'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ldhName, 'migration.is-cool.dev');
  assert.equal(body.remarks[0].title, 'Subdomain under Open Domains');
  assert.equal(queries.filter(query => query.entity === 'Domain').length, 1);
  assert.deepEqual(queries[0].filter.name.$in, ['migration.is-cool.dev', 'is-cool.dev']);
});

test('RDAP rejects oversized or malformed names before querying', async t => {
  let queries = 0;
  t.mock.method(store, 'filter', async () => { queries++; return []; });
  for (const domain of ['a.'.repeat(5000) + 'dev', 'x'.repeat(64) + '.dev', 'bad label.dev', 'localhost', '', 42]) {
    const response = await rdapLookup(rdapRequest(domain));
    assert.equal(response.status, 400, String(domain).slice(0, 20));
  }
  assert.equal(queries, 0);
});
