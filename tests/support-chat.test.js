import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSupportChatTicket, normalizeSupportSubdomainOptions } from '../src/lib/support-chat.js';

test('normalizeSupportSubdomainOptions uses authenticated account subdomains and adds account option', () => {
  const options = normalizeSupportSubdomainOptions([
    { id: '2', full_name: 'beta.open-domains.net', root_domain: 'open-domains.net', status: 'active' },
    { id: '1', full_name: 'alpha.open-domains.net', root_domain: 'open-domains.net', status: 'suspended' },
    { id: '3', subdomain: 'gamma', root_domain: 'is-not-a.dev', status: 'active' },
  ]);

  assert.deepEqual(options.map(option => option.value), [
    'account',
    'alpha.open-domains.net',
    'beta.open-domains.net',
    'gamma.is-not-a.dev',
  ]);
  assert.equal(options[0].label, 'My account / login');
  assert.equal(options[1].status, 'suspended');
});

test('buildSupportChatTicket includes selected subdomain, issue details, account context and path', () => {
  const payload = buildSupportChatTicket({
    selectedSubdomain: 'alpha.open-domains.net',
    topic: 'dns',
    summary: 'DNS records are not applying',
    details: 'I changed my CNAME yesterday and it still resolves to the old target.',
    user: { id: 'u_123', email: 'owner@example.com', full_name: 'Owner User', role: 'user' },
    path: '/my-subdomains',
  });

  assert.equal(payload.category, 'dns');
  assert.equal(payload.subject, 'alpha.open-domains.net: DNS records are not applying');
  assert.match(payload.message, /Subdomain: alpha\.open-domains\.net/);
  assert.match(payload.message, /Issue type: DNS/);
  assert.match(payload.message, /I changed my CNAME yesterday/);
  assert.deepEqual(payload.context, {
    source: 'floating_support_chat',
    path: '/my-subdomains',
    selected_subdomain: 'alpha.open-domains.net',
    issue_type: 'DNS',
    user_id: 'u_123',
    user_email: 'owner@example.com',
    user_role: 'user',
  });
});

test('buildSupportChatTicket creates account-scoped tickets when no subdomain applies', () => {
  const payload = buildSupportChatTicket({
    selectedSubdomain: 'account',
    topic: 'account',
    summary: 'Cannot enable passkeys',
    details: 'The passkey setup step fails after browser confirmation.',
    user: { id: 'u_123', email: 'owner@example.com', role: 'user' },
    path: '/settings',
  });

  assert.equal(payload.category, 'account');
  assert.equal(payload.subject, 'Account: Cannot enable passkeys');
  assert.match(payload.message, /Area: My account \/ login/);
  assert.equal(payload.context.selected_subdomain, 'account');
});
