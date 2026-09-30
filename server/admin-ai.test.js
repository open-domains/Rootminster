import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdminAiExecutor, parseAdminAiInput, safeUser } from './admin-ai.js';

const actor = { id: 'admin-ai', email: 'admin-ai@open-domains.local', full_name: 'Admin AI', role: 'admin' };

test('parseAdminAiInput accepts a single tool call from JSON', () => {
  assert.deepEqual(parseAdminAiInput('{"tool":"get_review_request","arguments":{"request_id":"req-1"}}'), {
    actions: [{ tool: 'get_review_request', arguments: { request_id: 'req-1' } }],
    dry_run: false,
  });
});

test('parseAdminAiInput accepts batch actions and rejects malformed payloads', () => {
  assert.deepEqual(parseAdminAiInput({ dry_run: true, actions: [{ tool: 'list_pending_reviews', arguments: { limit: 5 } }] }), {
    actions: [{ tool: 'list_pending_reviews', arguments: { limit: 5 } }],
    dry_run: true,
  });
  assert.throws(() => parseAdminAiInput('{"actions":[]}'), /at least one action/);
  assert.throws(() => parseAdminAiInput('{"actions":[{"tool":""}]}'), /action 1 tool is required/);
});

test('safeUser removes sensitive account fields', () => {
  assert.deepEqual(safeUser({ id: 'u1', email: 'person@example.com', totp_secret: 'secret', password_hash: 'hash', role: 'user' }), {
    id: 'u1',
    email: 'person@example.com',
    role: 'user',
  });
});

test('admin AI executor runs review tools and batches independent results', async () => {
  const calls = [];
  const executor = createAdminAiExecutor({
    actor,
    callReviewTool: async (tool, args, user) => {
      calls.push({ tool, args, user });
      return { structuredContent: { ok: tool, args } };
    },
  });

  const result = await executor.run({
    actions: [
      { tool: 'list_pending_reviews', arguments: { limit: 2 } },
      { tool: 'approve_review', arguments: { request_id: 'req-1', admin_notes: 'Looks good' } },
    ],
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.results.map(item => item.ok), [true, true]);
  assert.deepEqual(result.results.map(item => item.result), [
    { ok: 'list_pending_reviews', args: { limit: 2 } },
    { ok: 'approve_review', args: { request_id: 'req-1', admin_notes: 'Looks good' } },
  ]);
  assert.equal(calls[1].user.email, actor.email);
});

test('admin AI executor supports dry-run without mutating review or account tools', async () => {
  const executor = createAdminAiExecutor({
    actor,
    callReviewTool: async () => assert.fail('dry run should not call review tools'),
    invokeInternal: async () => assert.fail('dry run should not update users'),
  });

  const result = await executor.run({
    dry_run: true,
    actions: [
      { tool: 'reject_review', arguments: { request_id: 'req-1', rejection_reason: 'Policy issue' } },
      { tool: 'update_user', arguments: { user_id: 'user-1', data: { status: 'suspended' } } },
    ],
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.results.map(item => item.dry_run), [true, true]);
});

test('admin AI executor updates users through the internal admin function and sanitizes output', async () => {
  const invocations = [];
  const executor = createAdminAiExecutor({
    actor,
    invokeInternal: async (name, body, user) => {
      invocations.push({ name, body, user });
      return { user: { id: body.user_id, email: 'person@example.com', status: body.data.status, totp_secret: 'hidden', password_hash: 'hidden' } };
    },
  });

  const result = await executor.run({ actions: [{ tool: 'update_user', arguments: { user_id: 'user-1', data: { status: 'suspended' } } }] });

  assert.equal(result.results[0].ok, true);
  assert.deepEqual(result.results[0].result.user, { id: 'user-1', email: 'person@example.com', status: 'suspended' });
  assert.deepEqual(invocations[0].body, { action: 'update_user', user_id: 'user-1', data: { status: 'suspended' } });
  assert.equal(invocations[0].user.email, actor.email);
});

test('admin AI executor validates update_user payloads', async () => {
  const executor = createAdminAiExecutor({ actor });
  const result = await executor.run({ actions: [{ tool: 'update_user', arguments: { user_id: '', data: { status: 'suspended' } } }] });
  assert.equal(result.success, false);
  assert.equal(result.results[0].ok, false);
  assert.match(result.results[0].error, /user_id is required/);
});
