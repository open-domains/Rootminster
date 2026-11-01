import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { registerEntityRoutes } from './entity-routes.js';
import { store } from './store.js';
import { pool } from './database.js';
import { sha256 } from './security.js';

async function fixture(t, role) {
  const account = { id: 'u1', email: `${role}@example.test`, role, status: 'active' };
  const entries = [{ id: 'b1', value: 'bad.example', record_type: 'ANY', added_by: 'admin@example.test' }];
  const created = [];
  t.mock.method(store, 'get', async (entity, id) => structuredClone(entity === 'BlocklistEntry' ? entries.find(row => row.id === id) || null : null));
  t.mock.method(store, 'filter', async entity => structuredClone(entity === 'BlocklistEntry' ? entries : []));
  t.mock.method(store, 'create', async (entity, body) => { created.push(body); return { id: 'new', ...body }; });
  t.mock.method(store, 'update', async (entity, id, body) => ({ id, ...body }));
  t.mock.method(store, 'delete', async (entity, id) => ({ id }));
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM sessions s JOIN users')) {
      return { rows: params[0] === sha256('browser-session') ? [{ ...account, _session_id: 'session', _session_mfa_verified_at: new Date() }] : [] };
    }
    return { rows: [] };
  });
  const app = Fastify();
  await registerEntityRoutes(app);
  t.after(() => app.close());
  const send = (method, url, payload) => app.inject({ method, url, payload, headers: { authorization: 'Bearer browser-session' } });
  return { send, created };
}

const entry = { value: '1.2.3.4', record_type: 'A', reason: 'Phishing', added_by: 'someone-else@example.test' };

test('staff can read and add blocklist entries, recorded under their own email', async t => {
  const f = await fixture(t, 'staff');
  assert.equal((await f.send('GET', '/api/entities/BlocklistEntry')).statusCode, 200);
  const response = await f.send('POST', '/api/entities/BlocklistEntry', entry);
  assert.equal(response.statusCode, 201, response.body);
  assert.equal(f.created[0].added_by, 'staff@example.test');
  assert.equal(f.created[0].value, '1.2.3.4');
});

test('staff cannot edit or remove blocklist entries', async t => {
  const f = await fixture(t, 'staff');
  assert.equal((await f.send('PATCH', '/api/entities/BlocklistEntry/b1', { value: 'x' })).statusCode, 403);
  assert.equal((await f.send('DELETE', '/api/entities/BlocklistEntry/b1')).statusCode, 403);
});

test('regular users cannot add blocklist entries', async t => {
  const f = await fixture(t, 'user');
  assert.equal((await f.send('POST', '/api/entities/BlocklistEntry', entry)).statusCode, 403);
  assert.equal(f.created.length, 0);
});

test('admins can still add and remove blocklist entries', async t => {
  const f = await fixture(t, 'admin');
  assert.equal((await f.send('POST', '/api/entities/BlocklistEntry', entry)).statusCode, 201);
  assert.equal(f.created[0].added_by, 'admin@example.test');
  assert.equal((await f.send('DELETE', '/api/entities/BlocklistEntry/b1')).statusCode, 200);
});
