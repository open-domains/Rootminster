import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { pool } from '../../server/core/database.js';
import { store } from '../../server/core/store.js';
import { saveModule } from '../../server/core/module-settings.js';
import { registerAuthRoutes } from '../../server/routes/auth.js';

const admin = { id: 'admin', email: 'admin@example.test', role: 'admin' };

// Module settings live in PlatformSettings; everything else is an in-memory stand-in.
function fixture(t, modules = {}) {
  const settings = Object.entries({
    email: { enabled: true, require_verification: false },
    ...modules,
  }).map(([id, value]) => ({ id, key: `module_config:${id}`, value: JSON.stringify(value) }));
  const inserted = [];
  t.mock.method(store, 'filter', async (entity, filter) => (entity === 'PlatformSettings' ? structuredClone(settings.filter((row) => row.key === filter.key)) : []));
  t.mock.method(store, 'create', async (entity, value) => {
    const row = { ...value, id: value.key?.replace('module_config:', '') || `${entity}-new` };
    if (entity === 'PlatformSettings') settings.push(row);
    return row;
  });
  t.mock.method(store, 'update', async (_entity, id, patch) => {
    const row = settings.find((item) => item.id === id);
    Object.assign(row, patch);
    return row;
  });
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('SELECT id, status FROM users')) return { rowCount: 0, rows: [] };
    if (sql.includes('INSERT INTO users')) {
      inserted.push(params);
      return { rowCount: 1, rows: [{ id: 'new-user', email: params[0], full_name: params[2], status: params[3], role: 'user' }] };
    }
    if (sql.includes('INSERT INTO sessions')) return { rowCount: 1, rows: [{ id: 'session' }] };
    return { rowCount: 0, rows: [] };
  });
  return { inserted };
}

async function app(t) {
  const server = Fastify();
  await server.register(cookie);
  await registerAuthRoutes(server);
  t.after(() => server.close());
  return server;
}

const signup = { firstName: 'Sam', email: 'sam@example.test', password: 'a-long-password' };

test('password sign-up still works while social-only sign-ups are off', async (t) => {
  const { inserted } = fixture(t);
  await saveModule('social_signup_only', { enabled: false }, admin);
  const response = await (await app(t)).inject({ method: 'POST', url: '/api/auth/register', payload: signup });
  assert.equal(response.statusCode, 201);
  assert.equal(inserted.length, 1);
});

test('social-only sign-ups block password registration on the server', async (t) => {
  const { inserted } = fixture(t, { github_oauth: { enabled: true, client_id: 'id', client_secret: 'secret' } });
  await saveModule('social_signup_only', { enabled: true }, admin);
  const response = await (await app(t)).inject({ method: 'POST', url: '/api/auth/register', payload: signup });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, 'password_signup_disabled');
  assert.equal(inserted.length, 0, 'no account row may be written');
});

test('social-only sign-ups cannot be turned on without a configured sign-in provider', async (t) => {
  fixture(t, { github_oauth: { enabled: true, client_id: 'id', client_secret: '' }, google_oauth: { enabled: false, client_id: 'id', client_secret: 'secret' } });
  await assert.rejects(saveModule('social_signup_only', { enabled: true }, admin), /Set up the Google, GitHub or Discord OAuth module/);
});

test('social-only sign-ups leave password sign-in for existing accounts alone', async () => {
  const { readFile } = await import('node:fs/promises');
  const auth = await readFile(new URL('../../server/routes/auth.js', import.meta.url), 'utf8');
  const register = auth.slice(auth.indexOf("app.post('/api/auth/register'"), auth.indexOf("app.post('/api/auth/verify-email'"));
  const elsewhere = auth.replace(register, '');
  assert.match(register, /passwordSignupAllowed\(\)/);
  assert.doesNotMatch(elsewhere, /passwordSignupAllowed\(\)/, 'only account creation checks the setting');
});
