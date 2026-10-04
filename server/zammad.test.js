import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZammadTicketPayload } from './zammad.js';

test('Zammad ticket payload includes authenticated Rootminster user context', () => {
  const payload = buildZammadTicketPayload({
    category: 'dns',
    subject: 'Records are not provisioning',
    message: 'My A record is still pending.',
    name: 'Fallback Name',
    email: 'fallback@example.com',
    user: {
      id: 'user-123',
      email: 'owner@example.com',
      full_name: 'Domain Owner',
      role: 'user',
      status: 'active',
    },
    context: {
      request_id: 'req-123',
      hostname: 'demo.is-cool.dev',
      path: '/my-requests',
    },
  }, { group: 'DNS / Subdomains' });

  assert.equal(payload.title, '[DNS] Records are not provisioning');
  assert.equal(payload.group, 'DNS / Subdomains');
  assert.equal(payload.customer, 'owner@example.com');
  assert.equal(payload.article.type, 'web');
  assert.match(payload.article.body, /Rootminster user/);
  assert.match(payload.article.body, /user-123/);
  assert.match(payload.article.body, /owner@example.com/);
  assert.match(payload.article.body, /demo\.is-cool\.dev/);
  assert.doesNotMatch(payload.article.body, /fallback@example.com/);
});

test('Zammad ticket payload supports public reporters without leaking empty context', () => {
  const payload = buildZammadTicketPayload({
    category: 'privacy',
    subject: 'Delete my data',
    message: 'Please help with a privacy request.',
    name: 'Privacy User',
    email: 'privacy@example.com',
  }, { group: 'Privacy / Legal' });

  assert.equal(payload.title, '[Privacy] Delete my data');
  assert.equal(payload.group, 'Privacy / Legal');
  assert.equal(payload.customer, 'privacy@example.com');
  assert.match(payload.article.body, /Privacy User/);
  assert.doesNotMatch(payload.article.body, /Rootminster user/);
});
