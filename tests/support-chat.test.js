import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SUPPORT_TOPICS,
  WAIT_TIME_REPLY,
  buildSupportChatTicket,
  getTopic,
  isWaitTimeQuestion,
  normalizeSupportSubdomainOptions,
} from '../src/lib/support-chat.js';

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

test('every ticket-opening topic asks at least one question before a ticket can be opened', () => {
  for (const topic of SUPPORT_TOPICS.filter(t => !t.noTicket)) {
    assert.ok(topic.questions.length > 0, `${topic.id} has no questions`);
    for (const question of topic.questions) {
      assert.ok(question.id && question.prompt, `${topic.id} has an incomplete question`);
    }
  }
});

test('the wait-time topic never opens a ticket and replies about volunteer availability', () => {
  const wait = getTopic('wait_time');
  assert.equal(wait.noTicket, true);
  assert.deepEqual(wait.questions, []);
  assert.match(WAIT_TIME_REPLY, /volunteer/i);
  assert.match(WAIT_TIME_REPLY, /availability/i);
});

test('isWaitTimeQuestion detects review wait-time questions', () => {
  for (const text of [
    'How long does it take to get approved?',
    'My request has been pending for 5 days',
    'When will my subdomain be reviewed?',
    'Why is the wait time so long',
    "It still hasn't been approved",
    'Can you speed up my request?',
  ]) {
    assert.equal(isWaitTimeQuestion(text), true, text);
  }
});

test('isWaitTimeQuestion ignores unrelated technical problems', () => {
  for (const text of [
    'My CNAME points to the wrong target',
    'SSL certificate error on my site',
    'I cannot enable passkeys',
    '',
  ]) {
    assert.equal(isWaitTimeQuestion(text), false, text);
  }
});

test('buildSupportChatTicket includes subdomain, topic and every answered question', () => {
  const payload = buildSupportChatTicket({
    selectedSubdomain: 'alpha.open-domains.net',
    topic: 'dns',
    answers: [
      { question: 'Which record is affected?', answer: 'CNAME -> alpha.github.io' },
      { question: 'When did you make the change?', answer: 'Yesterday' },
      { question: 'Anything else?', answer: '' },
    ],
    user: { id: 'u_123', email: 'owner@example.com', role: 'user' },
    path: '/my-subdomains',
  });

  assert.equal(payload.category, 'dns');
  assert.equal(payload.subject, `alpha.open-domains.net: ${getTopic('dns').label}`);
  assert.match(payload.message, /Subdomain: alpha\.open-domains\.net/);
  assert.match(payload.message, /Which record is affected\?\nCNAME -> alpha\.github\.io/);
  assert.match(payload.message, /When did you make the change\?\nYesterday/);
  assert.doesNotMatch(payload.message, /Anything else\?/);
  assert.equal(payload.context.source, 'floating_support_chat');
  assert.equal(payload.context.selected_subdomain, 'alpha.open-domains.net');
  assert.equal(payload.context.user_id, 'u_123');
});

test('buildSupportChatTicket refuses to build a ticket for the wait-time topic', () => {
  assert.throws(() => buildSupportChatTicket({
    selectedSubdomain: 'account',
    topic: 'wait_time',
    answers: [],
    user: { id: 'u_1' },
  }), /does not open a ticket/);
});

test('buildSupportChatTicket creates account-scoped tickets', () => {
  const payload = buildSupportChatTicket({
    selectedSubdomain: 'account',
    topic: 'account',
    answers: [{ question: 'What are you trying to do?', answer: 'Enable a passkey' }],
    user: { id: 'u_123', email: 'owner@example.com', role: 'user' },
    path: '/settings',
  });

  assert.equal(payload.category, 'account');
  assert.match(payload.subject, /^Account: /);
  assert.match(payload.message, /Area: My account \/ login/);
});
