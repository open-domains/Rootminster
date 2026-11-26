import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { verifyDiscordSignature } from '../../server/integrations/discord.js';

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
  const { registerDiscordRoutes } = await import('../../server/integrations/discord.js');
  const { store } = await import('../../server/core/store.js');
  const { pool } = await import('../../server/core/database.js');
  const { getModuleConfig } = await import('../../server/core/module-settings.js');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const sent = [];
  const errors = [];
  let rejectRichResponse = false;
  t.mock.method(store, 'filter', async () => [{ value: JSON.stringify({ enabled: true, application_id: '123', public_key: publicHex, bot_token: 'fake', guild_id: '456' }) }]);
  await getModuleConfig('discord', { fresh: true });
  const claimed = new Set();
  t.mock.method(pool, 'query', async (sql, args) => {
    if (sql.includes('INSERT INTO discord_interactions')) { if (claimed.has(args[0])) return { rowCount: 0 }; claimed.add(args[0]); return { rowCount: 1 }; }
    return { rowCount: 0, rows: [] };
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    sent.push({ url, body });
    if (rejectRichResponse && url.includes('/webhooks/') && body.components?.length) {
      return { ok: false, status: 400, json: async () => ({ code: 50035, errors: { components: { _errors: [{ code: 'INVALID_URL', message: 'Invalid URL' }] } } }) };
    }
    return { ok: true };
  });
  const app = Fastify();
  app.addHook('onRequest', async request => { request.log.error = (details, message) => errors.push({ details, message }); });
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

  // A rejected rich response must not be reported as a failed command or
  // repeat the action. Keep Discord validation details out of the reply.
  rejectRichResponse = true;
  const linkResponse = (await inject({ id: '3', type: 2, token: 'private-token', user: { id: '123456789012345678' }, data: { name: 'link' } })).json();
  assert.equal(linkResponse.type, 5);
  await new Promise(resolve => setImmediate(resolve));
  const deliveryError = errors.find(entry => entry.message === 'Discord response update failed');
  assert.equal(deliveryError.details.discordCode, 50035);
  assert.equal(deliveryError.details.discordErrors.components._errors[0].code, 'INVALID_URL');
  assert.equal(deliveryError.details.command, 'link');
  assert.equal(deliveryError.details.interactionId, '3');
  assert.equal(errors.some(entry => entry.message === 'Discord command failed' && entry.details.interactionId === '3'), false);
  assert.equal(JSON.stringify(errors).includes('private-token'), false);
  assert.match(sent.at(-1).body.content, /action may have completed/);
  assert.deepEqual(sent.at(-1).body.components, []);
});

test('ticket interactions: unlinked users get the link prompt and the wizard updates in place', async t => {
  const { default: Fastify } = await import('fastify');
  const { default: rawBody } = await import('fastify-raw-body');
  const { registerDiscordRoutes } = await import('../../server/integrations/discord.js');
  const { store } = await import('../../server/core/store.js');
  const { pool } = await import('../../server/core/database.js');
  const { getModuleConfig } = await import('../../server/core/module-settings.js');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const sent = [];
  t.mock.method(store, 'filter', async (entity, filter) => [{ value: JSON.stringify(filter.key === 'module_config:discord_tickets'
    ? { enabled: true, open_category_id: '100000000000000004', closed_category_id: '100000000000000005', categories: 'Other: How can we help?' }
    : { enabled: true, application_id: '123', public_key: publicHex, bot_token: 'fake', guild_id: '456' }) }]);
  await getModuleConfig('discord', { fresh: true });
  await getModuleConfig('discord_tickets', { fresh: true });
  t.mock.method(pool, 'query', async (sql) => (sql.includes('INSERT INTO discord_interactions') ? { rowCount: 1, rows: [{}] } : { rowCount: 0, rows: [] }));
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
  const user = { id: '123456789012345678', username: 'someone' };

  assert.deepEqual((await inject({ id: 't1', type: 3, token: 'a', user, data: { custom_id: 'tk:open' } })).json(), { type: 5, data: { flags: 64 } });
  await new Promise(resolve => setImmediate(resolve));
  const prompt = sent.find(item => item.url.includes('/webhooks/'));
  assert.match(prompt.body.content, /first link your Open Domains account/);
  assert.match(prompt.body.components[0].components[0].url, /discord-link\?token=/);

  assert.deepEqual((await inject({ id: 't2', type: 3, token: 'b', user, data: { custom_id: 'tk:cat', values: ['other'] } })).json(), { type: 6 });

  const form = (await inject({ id: 't3', type: 3, token: 'c', user, data: { custom_id: 'tk:sub:other', values: ['none'] } })).json();
  assert.equal(form.type, 9);
  assert.equal(form.data.custom_id, 'tk:submit:other:none');
});

test('the link prompt uses the branded site name', async t => {
  const { default: Fastify } = await import('fastify');
  const { default: rawBody } = await import('fastify-raw-body');
  const { registerDiscordRoutes } = await import('../../server/integrations/discord.js');
  const { store } = await import('../../server/core/store.js');
  const { pool } = await import('../../server/core/database.js');
  const { getModuleConfig } = await import('../../server/core/module-settings.js');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const sent = [];
  t.mock.method(store, 'filter', async (entity, filter) => [{ value: JSON.stringify(filter.key === 'module_config:branding'
    ? { enabled: true, platform_name: 'Acme Hosting' }
    : { enabled: true, application_id: '123', public_key: publicHex, bot_token: 'fake', guild_id: '456' }) }]);
  await getModuleConfig('discord', { fresh: true });
  await getModuleConfig('branding', { fresh: true });
  t.mock.method(pool, 'query', async (sql) => (sql.includes('INSERT INTO discord_interactions') ? { rowCount: 1, rows: [{}] } : { rowCount: 0, rows: [] }));
  t.mock.method(globalThis, 'fetch', async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return { ok: true }; });
  const app = Fastify();
  await app.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });
  await registerDiscordRoutes(app);
  t.after(() => app.close());
  const payload = JSON.stringify({ id: 'b1', type: 2, token: 'x', user: { id: '123456789012345678', username: 'someone' }, data: { name: 'ticket' } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.sign(null, Buffer.from(timestamp + payload), privateKey).toString('hex');
  await app.inject({ method: 'POST', url: '/api/discord/interactions', payload, headers: { 'content-type': 'application/json', 'x-signature-timestamp': timestamp, 'x-signature-ed25519': signature } });
  await new Promise(resolve => setImmediate(resolve));
  const prompt = sent.find(item => item.url.includes('/webhooks/'));
  assert.equal(prompt.body.content, 'To open a ticket, first link your Acme Hosting account so we can see your subdomains. Connect your Discord account to Acme Hosting. This private link expires in 15 minutes and can only be used once.');
  assert.equal(prompt.body.components[0].components[0].label, 'Link Acme Hosting account');
});
