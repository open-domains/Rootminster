import assert from 'node:assert/strict';
import test from 'node:test';
import { acmeCredential, challengeBaseHostname, challengeExpired, cleanupExpiredAcmeChallenges, validChallengeValue } from '../../../server/lib/acme-challenges.js';
import { tokenAllowsAcme } from '../../../server/routes/public-api.js';

test('challenge names must be _acme-challenge under a real hostname', () => {
  assert.equal(challengeBaseHostname('_acme-challenge.Home.Example.com.'), 'home.example.com');
  assert.equal(challengeBaseHostname('_acme-challenge.home.example.com'), 'home.example.com');
  for (const bad of ['home.example.com', '_acme-challenge.', '_acme-challenge.com', 'x._acme-challenge.home.example.com', '_acme-challenge.*.example.com', '_acme-challenge.a b.example.com', '']) {
    assert.equal(challengeBaseHostname(bad), null, bad);
  }
});

test('challenge values are base64url digests', () => {
  assert.equal(validChallengeValue('gfj9Xq-Rk3s_WhZ2bG7bJ0fF4yZxVnq0lL5tP1cXy8c'), true);
  for (const bad of ['', 'short', 'has space in it but long enough!', '"quoted-value-xxxxxxxxxxxxxxxx"', 42, null]) assert.equal(validChallengeValue(bad), false);
});

test('ACME credential accepts Bearer or the Basic password', () => {
  assert.equal(acmeCredential('Bearer od_secret'), 'od_secret');
  const basic = `Basic ${Buffer.from('token:od_secret').toString('base64')}`;
  assert.equal(acmeCredential(basic), 'od_secret');
  assert.equal(acmeCredential(`Basic ${Buffer.from('nopassword').toString('base64')}`), null);
  assert.equal(acmeCredential(''), null);
});

test('dns:acme tokens are limited to their hostnames, dns:write tokens to TXT rules', () => {
  const acme = { token: { scopes: ['dns:acme'], allowed_hostnames: ['home.example.com'], allowed_record_types: [] } };
  assert.equal(tokenAllowsAcme(acme, 'home.example.com'), true);
  assert.equal(tokenAllowsAcme(acme, 'other.example.com'), false);
  const writeA = { token: { scopes: ['dns:write'], allowed_hostnames: [], allowed_record_types: ['A'] } };
  assert.equal(tokenAllowsAcme(writeA, 'home.example.com'), false);
  const writeTxt = { token: { scopes: ['dns:write'], allowed_hostnames: ['home.example.com'], allowed_record_types: ['TXT'] } };
  assert.equal(tokenAllowsAcme(writeTxt, 'home.example.com'), true);
  const readOnly = { token: { scopes: ['dns:read'], allowed_hostnames: [], allowed_record_types: [] } };
  assert.equal(tokenAllowsAcme(readOnly, 'home.example.com'), false);
});

test('cleanup deletes only expired challenge records', async () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const rows = [
    { id: 'old', name: '_acme-challenge.a.example.com', acme_challenge: true, acme_expires_at: '2026-11-24T11:00:00Z' },
    { id: 'fresh', name: '_acme-challenge.b.example.com', acme_challenge: true, acme_expires_at: '2026-11-24T13:00:00Z' },
    { id: 'manual', name: '_acme-challenge.c.example.com', acme_challenge: false },
  ];
  assert.equal(challengeExpired(rows[2], now), false);
  const deleted = [];
  const fakeStore = { filter: async (entity, filter) => { assert.equal(entity, 'DnsRecord'); assert.deepEqual(filter, { acme_challenge: true }); return rows; } };
  const summary = await cleanupExpiredAcmeChallenges({ store: fakeStore, deleteRecord: async (record) => deleted.push(record.id), now });
  assert.deepEqual(deleted, ['old']);
  assert.equal(summary.deleted, 1);
});
