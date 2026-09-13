import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { verifyDiscordSignature } from './discord.js';

test('Discord interaction signatures are verified with Ed25519', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const publicHex = publicDer.subarray(-32).toString('hex');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: 1 });
  const signature = crypto.sign(null, Buffer.from(`${timestamp}${body}`), privateKey).toString('hex');

  assert.equal(verifyDiscordSignature(body, timestamp, signature, publicHex), true);
  assert.equal(verifyDiscordSignature(`${body} `, timestamp, signature, publicHex), false);
  assert.equal(verifyDiscordSignature(body, timestamp, 'not-a-signature', publicHex), false);
  const staleTimestamp = String(Number(timestamp) - 301);
  const staleSignature = crypto.sign(null, Buffer.from(`${staleTimestamp}${body}`), privateKey).toString('hex');
  assert.equal(verifyDiscordSignature(body, staleTimestamp, staleSignature, publicHex), false);
});

test('signed buttons open modals immediately, defer data views privately, and deduplicate delivery', async t => {
  const { default: Fastify } = await import('fastify');
  const { default: rawBody } = await import('fastify-raw-body');
  const { registerDiscordRoutes } = await import('./discord.js');
  const { store } = await import('./store.js');
  const { pool } = await import('./database.js');
  const { getModuleConfig } = await import('./module-settings.js');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const sent = [];
  t.mock.method(store, 'filter', async () => [{ value: JSON.stringify({ enabled: true, application_id: '123', public_key: publicHex, bot_token: 'fake', guild_id: '456' }) }]);
  await getModuleConfig('discord', { fresh: true });
  const claimed = new Set();
  t.mock.method(pool, 'query', async (sql, args) => {
    if (sql.includes('INSERT INTO discord_interactions')) { if (claimed.has(args[0])) return { rowCount: 0 }; claimed.add(args[0]); return { rowCount: 1 }; }
    return { rowCount: 0, rows: [] };
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return { ok: true }; });
  const app = Fastify();
  await app.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });
  await registerDiscordRoutes(app);
  t.after(() => app.close());
  const inject = async body => {
    const payload = JSON.stringify(body); const timestamp = String(Math.floor(Date.now()/1000));
    const signature = crypto.sign(null, Buffer.from(timestamp + payload), privateKey).toString('hex');
    return app.inject({ method: 'POST', url: '/api/discord/interactions', payload, headers: { 'content-type': 'application/json', 'x-signature-timestamp': timestamp, 'x-signature-ed25519': signature } });
  };
  const modal = { id: '1', type: 3, data: { custom_id: 'rm:question:11111111-1111-4111-8111-111111111111' } };
  assert.equal((await inject(modal)).json().type, 9);
  assert.match((await inject(modal)).json().data.content, /already been processed/);
  const response = (await inject({ id: '2', type: 3, user: { id: '123456789012345678' }, data: { custom_id: 'rm:list-mine:0' } })).json();
  assert.deepEqual(response, { type: 5, data: { flags: 64 } });
  await new Promise(resolve => setImmediate(resolve));
  const edited = sent.find(item => item.url.includes('/webhooks/'));
  assert.match(edited.body.content, /not linked/);
  assert.deepEqual(edited.body.allowed_mentions, { parse: [] });
  const bad = await app.inject({ method: 'POST', url: '/api/discord/interactions', payload: modal });
  assert.equal(bad.statusCode, 401);
});
