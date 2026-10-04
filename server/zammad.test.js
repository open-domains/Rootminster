import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZammadTicketPayload, createZammadTicketWithSettings } from './zammad.js';

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
  }, { group: 'DNS / Subdomains', support_email: 'support@example.com' });

  assert.equal(payload.title, '[DNS] Records are not provisioning');
  assert.equal(payload.group, 'DNS / Subdomains');
  assert.equal(payload.customer, 'owner@example.com');
  assert.equal(payload.article.type, 'email');
  assert.equal(payload.article.sender, 'Customer');
  assert.equal(payload.article.from, 'owner@example.com');
  assert.equal(payload.article.to, 'support@example.com');
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
  }, { group: 'Privacy / Legal', support_email: 'support@example.com' });

  assert.equal(payload.title, '[Privacy] Delete my data');
  assert.equal(payload.group, 'Privacy / Legal');
  assert.equal(payload.customer, 'privacy@example.com');
  assert.equal(payload.article.type, 'email');
  assert.equal(payload.article.sender, 'Customer');
  assert.equal(payload.article.from, 'privacy@example.com');
  assert.equal(payload.article.to, 'support@example.com');
  assert.match(payload.article.body, /Privacy User/);
  assert.doesNotMatch(payload.article.body, /Rootminster user/);
});

test('Zammad ticket creation creates a missing customer before retrying', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    requests.push({ url, method: options?.method || 'GET', body });
    if (url.endsWith('/api/v1/groups')) {
      return Response.json([{ id: 2, name: 'General Support', email_address_id: 10 }], { status: 200 });
    }
    if (url.endsWith('/api/v1/email_addresses')) {
      return Response.json([{ id: 10, email: 'support@example.com', active: true }], { status: 200 });
    }
    if (url.endsWith('/api/v1/tickets') && requests.filter(r => r.url.endsWith('/api/v1/tickets')).length === 1) {
      assert.equal(body.article.to, 'support@example.com');
      return Response.json({ error: 'No lookup value found for customer: "new-user@example.com"' }, { status: 422 });
    }
    if (url.endsWith('/api/v1/users')) {
      assert.deepEqual(body, {
        email: 'new-user@example.com',
        login: 'new-user@example.com',
        firstname: 'New',
        lastname: 'User',
        roles: ['Customer'],
      });
      return Response.json({ id: 42, email: 'new-user@example.com' }, { status: 201 });
    }
    if (url.endsWith('/api/v1/tickets')) {
      return Response.json({ id: 77, number: '77077', title: body.title }, { status: 201 });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const ticket = await createZammadTicketWithSettings({
    category: 'general',
    subject: 'Help me',
    message: 'I need help.',
    name: 'New User',
    email: 'new-user@example.com',
  }, null, {
    api_url: 'https://support.example.test',
    api_token: 'secret-token',
    default_group: 'General Support',
  }, fetchImpl);

  assert.equal(ticket.id, 77);
  assert.deepEqual(requests.map(r => `${r.method} ${new URL(r.url).pathname}`), [
    'GET /api/v1/groups',
    'GET /api/v1/email_addresses',
    'POST /api/v1/tickets',
    'POST /api/v1/users',
    'POST /api/v1/tickets',
  ]);
});

test('Zammad ticket creation resolves the recipient from the configured group email address', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    requests.push({ url, method: options?.method || 'GET', body });
    if (url.endsWith('/api/v1/groups')) {
      return Response.json([{ id: 7, name: 'Privacy / Legal', email_address_id: 12 }], { status: 200 });
    }
    if (url.endsWith('/api/v1/email_addresses')) {
      return Response.json([{ id: 12, email: 'privacy-support@example.com', active: true }], { status: 200 });
    }
    if (url.endsWith('/api/v1/tickets')) {
      assert.equal(body.article.to, 'privacy-support@example.com');
      assert.equal(body.article.sender, 'Customer');
      return Response.json({ id: 88, number: '88088', title: body.title }, { status: 201 });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const ticket = await createZammadTicketWithSettings({
    category: 'privacy',
    subject: 'Privacy help',
    message: 'Please help.',
    name: 'Privacy User',
    email: 'privacy-user@example.com',
  }, null, {
    api_url: 'https://support.example.test',
    api_token: 'secret-token',
    default_group: 'Privacy / Legal',
  }, fetchImpl);

  assert.equal(ticket.id, 88);
  assert.deepEqual(requests.map(r => `${r.method} ${new URL(r.url).pathname}`), [
    'GET /api/v1/groups',
    'GET /api/v1/email_addresses',
    'POST /api/v1/tickets',
  ]);
});
