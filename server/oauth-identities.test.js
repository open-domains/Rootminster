import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { IdentityError, linkIdentity, unlinkIdentity } from './lib/oauth-identities.js';
import { normaliseDiscordProfile, normaliseGithubProfile, normaliseGoogleProfile, oauthProvider } from './lib/oauth-providers.js';
import { matchesBlockedPrefix } from './impersonation-routes.js';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

// A tiny pg stand-in: answers queries by matching SQL fragments in order.
function fakeClient(handlers) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      const handler = handlers.find(([fragment]) => sql.includes(fragment));
      return handler ? handler[1](params) : { rowCount: 0, rows: [] };
    },
  };
}
const rows = (...items) => ({ rowCount: items.length, rows: items });

test('Discord profiles only expose an email Discord has verified', () => {
  assert.deepEqual(normaliseDiscordProfile({ id: '123456789012345678', username: 'andy', global_name: 'Andy', email: 'a@example.test', verified: true }), {
    id: '123456789012345678', email: 'a@example.test', name: 'Andy', username: 'andy',
  });
  assert.equal(normaliseDiscordProfile({ id: '1', username: 'x', email: 'a@example.test', verified: false }).email, null);
  assert.equal(normaliseDiscordProfile({ id: '1', username: 'x', email: 'a@example.test' }).email, null);
});

test('Google and GitHub profiles keep stable ids and verified emails only', () => {
  assert.equal(normaliseGoogleProfile({ sub: 'g1', email: 'a@example.test', email_verified: false }).email, null);
  assert.equal(normaliseGoogleProfile({ sub: 'g1', email: 'a@example.test', email_verified: true }).id, 'g1');
  const github = normaliseGithubProfile({ id: 42, login: 'octo' }, [
    { email: 'unverified@example.test', primary: true, verified: false },
    { email: 'second@example.test', primary: false, verified: true },
  ]);
  assert.deepEqual(github, { id: '42', email: 'second@example.test', name: 'octo', username: 'octo' });
  assert.equal(oauthProvider('constructor'), null);
  assert.equal(oauthProvider('discord').label, 'Discord');
});

test('linking refuses a provider account that belongs to another user', async () => {
  const client = fakeClient([
    ['FROM user_identities WHERE provider = $1 AND provider_user_id = $2', () => rows({ user_id: 'other-user' })],
  ]);
  await assert.rejects(linkIdentity(client, 'me', 'github', { id: '42' }), (error) => error instanceof IdentityError && error.code === 'in_use');
  assert.ok(!client.calls.some(({ sql }) => sql.includes('INSERT INTO user_identities')));
});

test('linking Discord refuses an account bot-linked to another user', async () => {
  const client = fakeClient([
    ['FROM discord_accounts WHERE discord_user_id = $1', () => rows({ user_id: 'other-user' })],
  ]);
  await assert.rejects(linkIdentity(client, 'me', 'discord', { id: '123' }), (error) => error.code === 'in_use');
});

test('linking refuses a second account for the same provider', async () => {
  const client = fakeClient([
    ['FROM user_identities WHERE user_id = $1 AND provider = $2', () => rows({ provider_user_id: 'old' })],
  ]);
  await assert.rejects(linkIdentity(client, 'me', 'google', { id: 'new' }), (error) => error.code === 'provider_taken');
});

test('a unique-constraint race while linking reports the account as in use', async () => {
  const client = fakeClient([
    ['INSERT INTO user_identities', () => { throw Object.assign(new Error('duplicate'), { code: '23505' }); }],
  ]);
  await assert.rejects(linkIdentity(client, 'me', 'google', { id: 'g1' }), (error) => error.code === 'in_use');
});

test('linking Discord also authorises the Discord bot for the same user', async () => {
  const client = fakeClient([]);
  await linkIdentity(client, 'me', 'discord', { id: '123', username: 'andy' });
  assert.ok(client.calls[0].sql.includes('FOR UPDATE'));
  const bot = client.calls.find(({ sql }) => sql.includes('INSERT INTO discord_accounts'));
  assert.deepEqual(bot.params, ['123', 'me', 'andy']);
});

test('unlinking refuses to remove the last sign-in method', async () => {
  const client = fakeClient([
    ['SELECT provider_user_id FROM user_identities', () => rows({ provider_user_id: 'g1' })],
    ['AS has_password', () => rows({ has_password: false, passkeys: 0, other_identities: 0 })],
  ]);
  await assert.rejects(unlinkIdentity(client, 'me', 'google'), (error) => error.code === 'last_method');
  assert.ok(!client.calls.some(({ sql }) => sql.startsWith('DELETE')));
});

test('unlinking succeeds when a password, passkey or other account remains', async () => {
  for (const methods of [{ has_password: true, passkeys: 0, other_identities: 0 }, { has_password: false, passkeys: 1, other_identities: 0 }, { has_password: false, passkeys: 0, other_identities: 1 }]) {
    const client = fakeClient([
      ['SELECT provider_user_id FROM user_identities', () => rows({ provider_user_id: '123' })],
      ['AS has_password', () => rows(methods)],
    ]);
    await unlinkIdentity(client, 'me', 'discord');
    assert.ok(client.calls.some(({ sql }) => sql.includes('DELETE FROM user_identities')));
    assert.ok(client.calls.some(({ sql, params }) => sql.includes('DELETE FROM discord_accounts') && params[1] === '123'));
  }
});

test('account linking stays off-limits during view-as sessions', () => {
  assert.equal(matchesBlockedPrefix('/api/auth/identities'), true);
  assert.equal(matchesBlockedPrefix('/api/auth/identities/discord'), true);
});

test('link callbacks must return to the session that started them', async () => {
  const auth = await source('./auth.js');
  const complete = auth.slice(auth.indexOf('async function completeLink'), auth.indexOf('async function oauthCallback'));
  assert.match(complete, /user\.id !== saved\.user_id/);
  assert.match(complete, /user\._session_id !== saved\.session_id/);
  assert.match(complete, /impersonation\?\.active/);
  const callback = auth.slice(auth.indexOf('async function oauthCallback'), auth.indexOf('export async function registerAuthRoutes'));
  // Email matching still goes through the pre-registration takeover protection.
  assert.match(callback, /if \(!profile\.email\) return reply\.code\(403\)/);
  assert.match(callback, /upsertOauthUser\(profile\.email, profile\.name\)/);
});
