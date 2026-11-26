import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createDiscordDeploys, deployRoles, signRunnerRequest } from '../../server/lib/discord-deploy.js';

const admin = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'admin@example.com', role: 'admin' };
const staffUser = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'staff@example.com', role: 'staff' };
const member = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'user@example.com', role: 'user' };
const identity = { id: '200000000000000001', username: 'Deployer' };
const interaction = (customId) => ({ type: 3, token: 'interaction-token', channel_id: '300000000000000001', data: { custom_id: customId } });
const ACTIVE = ['starting', 'running'];

// An in-memory deploy_runs table, including the one-active-run index.
function fakeDb() {
  const runs = [];
  const query = async (text, values = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT * FROM deploy_runs WHERE status = ANY')) {
      const rows = runs.filter((run) => values[0].includes(run.status)).reverse();
      return { rows: sql.includes('LIMIT 1') ? rows.slice(0, 1) : rows };
    }
    if (sql.startsWith('SELECT * FROM deploy_runs ORDER BY')) return { rows: runs.slice(-1) };
    if (sql.startsWith('SELECT * FROM deploy_runs WHERE id')) return { rows: runs.filter((run) => run.id === values[0]) };
    if (sql.startsWith('INSERT INTO deploy_runs')) {
      if (runs.some((run) => ACTIVE.includes(run.status))) throw Object.assign(new Error('duplicate key'), { code: '23505' });
      const [id, requested_by_id, requested_by_email, discord_user_id, discord_username, interaction_token, channel_id] = values;
      const run = { id, requested_by_id, requested_by_email, discord_user_id, discord_username, interaction_token, channel_id, status: 'starting', created_at: new Date().toISOString() };
      runs.push(run);
      return { rows: [{ ...run }] };
    }
    if (sql.startsWith("UPDATE deploy_runs SET status = 'running'")) {
      const run = runs.find((item) => item.id === values[0] && item.status === 'starting');
      if (run) Object.assign(run, { status: 'running', started_at: new Date().toISOString() });
      return { rows: run ? [{ ...run }] : [] };
    }
    if (sql.startsWith('UPDATE deploy_runs SET status = $2')) {
      const run = runs.find((item) => item.id === values[0] && values[5].includes(item.status));
      if (run) Object.assign(run, { status: values[1], exit_code: values[2], error: values[3], log_tail: values[4], finished_at: new Date().toISOString(), interaction_token: null });
      return { rows: run ? [{ ...run }] : [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  return { runs, query };
}

function setup({ settings = {}, runnerResponse } = {}) {
  const db = fakeDb();
  const runnerCalls = [];
  const discordCalls = [];
  const audits = [];
  const current = { enabled: true, runner_url: 'http://runner:9787', shared_secret: 'x'.repeat(40), allowed_roles: 'admin', log_channel_id: '400000000000000001', ...settings };
  const deploys = createDiscordDeploys({
    db,
    settings: async () => current,
    runner: async (config, method, path, payload) => {
      runnerCalls.push({ method, path, payload });
      if (runnerResponse) return runnerResponse(method, path, payload);
      return method === 'POST' ? { status: 202, body: { id: payload.id, status: 'running' } } : { status: 200, body: { status: 'running' } };
    },
    api: { call: async (method, path, body) => { discordCalls.push({ method, path, body }); return path === '/users/@me/channels' ? { id: '500000000000000001' } : {}; } },
    audit: async (entry) => { audits.push(entry); },
    platformName: async () => 'Open Domains',
    applicationId: async () => '600000000000000001',
    pollMs: 60_000,
    log: { error() {}, warn() {} },
  });
  return { db, deploys, runnerCalls, discordCalls, audits };
}

test('only the configured roles can open or confirm a redeploy', async () => {
  assert.deepEqual(deployRoles('admin'), ['admin']);
  assert.deepEqual(deployRoles('staff'), ['staff', 'admin']);
  const { deploys, runnerCalls } = setup();
  await assert.rejects(deploys.panel(staffUser), /Only admins/);
  await assert.rejects(deploys.component(interaction('dp:confirm'), member, identity), /Only admins/);
  assert.equal(runnerCalls.length, 0);

  const staffAllowed = setup({ settings: { allowed_roles: 'staff' } });
  await assert.rejects(staffAllowed.deploys.panel(member), /Staff access required/);
  const panel = await staffAllowed.deploys.panel(staffUser);
  assert.match(panel.content, /Redeploy Open Domains\?/);
});

test('a disabled module refuses before doing anything', async () => {
  const { deploys, runnerCalls } = setup({ settings: { enabled: false } });
  await assert.rejects(deploys.component(interaction('dp:confirm'), admin, identity), /turned off/);
  assert.equal(runnerCalls.length, 0);
});

test('/deploy asks for confirmation and cancel changes nothing', async () => {
  const { deploys, db, runnerCalls } = setup();
  const panel = await deploys.panel(admin);
  const buttons = panel.components[0].components.map((item) => item.custom_id);
  assert.deepEqual(buttons, ['dp:confirm', 'dp:cancel']);
  assert.deepEqual(panel.allowed_mentions, { parse: [] });
  const cancelled = await deploys.component(interaction('dp:cancel'), admin, identity);
  assert.match(cancelled.content, /cancelled/);
  assert.equal(db.runs.length, 0);
  assert.equal(runnerCalls.length, 0);
});

test('confirm starts one run, logs who started it and blocks a second run', async () => {
  const { deploys, db, runnerCalls, audits, discordCalls } = setup();
  const started = await deploys.component(interaction('dp:confirm'), admin, identity);
  assert.match(started.content, /Redeploy started/);
  assert.equal(db.runs.length, 1);
  assert.equal(db.runs[0].status, 'running');
  assert.equal(db.runs[0].requested_by_email, 'admin@example.com');
  assert.deepEqual(runnerCalls[0], { method: 'POST', path: '/runs', payload: { id: db.runs[0].id, requested_by: 'admin@example.com (Deployer)' } });
  assert.equal(audits[0].action, 'deploy_requested');
  assert.match(audits[0].description, /admin@example.com \(Discord Deployer\)/);
  assert.ok(discordCalls.some((call) => call.path === '/channels/400000000000000001/messages' && /started a redeploy/.test(call.body.content)));

  const second = await deploys.component(interaction('dp:confirm'), admin, { id: '200000000000000009', username: 'Other' });
  assert.match(second.content, /still running/);
  assert.equal(db.runs.length, 1);
  assert.equal(runnerCalls.length, 1);
});

test('runner rejections and outages mark the run failed and release the lock', async () => {
  for (const [response, pattern] of [
    [() => ({ status: 401, body: {} }), /shared secret/],
    [() => ({ status: 409, body: {} }), /already running a deploy/],
    [() => { throw Object.assign(new Error('The deploy runner could not be reached.'), { unreachable: true }); }, /could not be reached/],
  ]) {
    const { deploys, db } = setup({ runnerResponse: response });
    const result = await deploys.component(interaction('dp:confirm'), admin, identity);
    assert.match(result.content, pattern);
    assert.equal(db.runs[0].status, 'failed');
    assert.equal(db.runs[0].interaction_token, null);
  }
});

test('a finished run edits the Discord message, posts to the log channel and is reported once', async () => {
  let remote = { status: 'running' };
  const { deploys, db, discordCalls, audits } = setup({ runnerResponse: (method, path, payload) => (method === 'POST' ? { status: 202, body: { id: payload.id, status: 'running' } } : { status: 200, body: remote }) });
  await deploys.component(interaction('dp:confirm'), admin, identity);
  const run = { ...db.runs[0] };
  assert.equal(await deploys.check(run), null);
  remote = { status: 'failed', exit_code: 1, error: 'The update script exited with code 1.', log_tail: 'pull failed' };
  const done = await deploys.check(run);
  assert.equal(done.status, 'failed');
  assert.equal(db.runs[0].exit_code, 1);
  const edit = discordCalls.find((call) => call.method === 'PATCH');
  assert.equal(edit.path, '/webhooks/600000000000000001/interaction-token/messages/@original');
  assert.match(edit.body.content, /failed\. The update script exited with code 1\./);
  assert.match(edit.body.content, /pull failed/);
  assert.ok(audits.some((entry) => entry.action === 'deploy_failed'));
  const before = discordCalls.length;
  assert.equal(await deploys.check(run), null);
  assert.equal(discordCalls.length, before);
});

test('when the interaction token has expired the requester gets a DM', async () => {
  const { deploys, db, discordCalls } = setup({ runnerResponse: (method, path, payload) => (method === 'POST' ? { status: 202, body: { id: payload.id, status: 'running' } } : { status: 200, body: { status: 'succeeded', exit_code: 0 } }) });
  await deploys.component(interaction('dp:confirm'), admin, identity);
  db.runs[0].created_at = new Date(Date.now() - 20 * 60_000).toISOString();
  await deploys.check({ ...db.runs[0] });
  assert.ok(!discordCalls.some((call) => call.method === 'PATCH'));
  assert.ok(discordCalls.some((call) => call.path === '/users/@me/channels' && call.body.recipient_id === identity.id));
  assert.ok(discordCalls.some((call) => call.path === '/channels/500000000000000001/messages' && /finished successfully/.test(call.body.content)));
});

test('a lost run gives up after 45 minutes so redeploys are not blocked', async () => {
  const { deploys, db } = setup({ runnerResponse: (method, path, payload) => (method === 'POST' ? { status: 202, body: { id: payload.id, status: 'running' } } : { status: 200, body: { status: 'running' } }) });
  await deploys.component(interaction('dp:confirm'), admin, identity);
  db.runs[0].created_at = new Date(Date.now() - 50 * 60_000).toISOString();
  const done = await deploys.check({ ...db.runs[0] });
  assert.equal(done.status, 'unknown');
  const panel = await deploys.panel(admin);
  assert.equal(panel.components[0].components[0].custom_id, 'dp:confirm');
});

test('requests to the runner are signed over the timestamp, method, path and body', () => {
  const nonce = '0123456789abcdef0123456789abcdef';
  const headers = signRunnerRequest('secret', 'POST', '/runs', '{"id":"x"}', 1_700_000_000, nonce);
  const expected = crypto.createHmac('sha256', 'secret').update(`1700000000.${nonce}.POST./runs.{"id":"x"}`).digest('hex');
  assert.equal(headers['X-Rootminster-Timestamp'], '1700000000');
  assert.equal(headers['X-Rootminster-Nonce'], nonce);
  assert.match(signRunnerRequest('secret', 'GET', '/runs/a')['X-Rootminster-Nonce'], /^[0-9a-f]{32}$/);
  assert.equal(headers['X-Rootminster-Signature'], expected);
});
