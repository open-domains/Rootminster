import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRunnerClient, signRunnerRequest } from '../../server/lib/discord-deploy.js';

const RUNNER = new URL('../../scripts/deploy-runner/rootminster-deploy-runner.py', import.meta.url).pathname;
const hasPython = spawnSync('python3', ['--version']).status === 0;
const SECRET = 'a'.repeat(48);

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startRunner(scriptBody) {
  const dir = await mkdtemp(join(tmpdir(), 'deploy-runner-'));
  const script = join(dir, 'update.sh');
  await writeFile(script, `#!/bin/sh\n${scriptBody}\n`);
  await chmod(script, 0o755);
  const port = await freePort();
  const child = spawn('python3', ['-I', RUNNER], {
    env: { PATH: process.env.PATH, DEPLOY_RUNNER_SECRET: SECRET, DEPLOY_RUNNER_SCRIPT: script, DEPLOY_RUNNER_BIND: '127.0.0.1', DEPLOY_RUNNER_PORT: String(port), DEPLOY_RUNNER_STATE_DIR: join(dir, 'state'), DEPLOY_RUNNER_SHARE_LOG: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('listening')) resolve(); });
    child.on('exit', (code) => reject(new Error(`runner exited ${code}`)));
  });
  const settings = { runner_url: `http://127.0.0.1:${port}`, shared_secret: SECRET };
  return { dir, port, child, settings, stop: async () => { child.kill(); await rm(dir, { recursive: true, force: true }); } };
}

async function waitFor(call, settings, id) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await call(settings, 'GET', `/runs/${id}`);
    if (response.body.status !== 'running') return response;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('run did not finish');
}

test('runner runs the configured script once at a time and reports the result', { skip: !hasPython }, async () => {
  const runner = await startRunner('echo "deploying $ROOTMINSTER_DEPLOY_REQUESTED_BY"; sleep 0.5; echo "secret:${DEPLOY_RUNNER_SECRET:-unset}"; exit 3');
  try {
    const call = createRunnerClient();
    const id = crypto.randomUUID();
    const started = await call(runner.settings, 'POST', '/runs', { id, requested_by: 'admin@example.com (Deployer)' });
    assert.equal(started.status, 202);
    assert.equal(started.body.status, 'running');

    const blocked = await call(runner.settings, 'POST', '/runs', { id: crypto.randomUUID(), requested_by: 'someone' });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.run.id, id);

    const again = await call(runner.settings, 'POST', '/runs', { id, requested_by: 'admin@example.com' });
    assert.equal(again.status, 200, 'retrying the same run ID does not start a second run');

    const finished = await waitFor(call, runner.settings, id);
    assert.equal(finished.body.status, 'failed');
    assert.equal(finished.body.exit_code, 3);
    assert.match(finished.body.log_tail, /deploying admin@example.com \(Deployer\)/);
    assert.match(finished.body.log_tail, /secret:unset/, 'the script never sees the runner secret');

    const next = await call(runner.settings, 'POST', '/runs', { id: crypto.randomUUID(), requested_by: 'admin@example.com' });
    assert.equal(next.status, 202, 'a finished run releases the lock');
  } finally {
    await runner.stop();
  }
});

test('runner rejects unsigned, wrongly signed and replayed requests', { skip: !hasPython }, async () => {
  const runner = await startRunner('exit 0');
  try {
    const base = runner.settings.runner_url;
    const body = JSON.stringify({ id: crypto.randomUUID(), requested_by: 'x' });
    assert.equal((await fetch(`${base}/runs`, { method: 'POST', body })).status, 401);
    const wrong = await createRunnerClient()({ ...runner.settings, shared_secret: 'b'.repeat(48) }, 'POST', '/runs', JSON.parse(body));
    assert.equal(wrong.status, 401);

    const headers = { ...signRunnerRequest(SECRET, 'POST', '/runs', body), 'Content-Type': 'application/json' };
    assert.equal((await fetch(`${base}/runs`, { method: 'POST', body, headers })).status, 202);
    assert.equal((await fetch(`${base}/runs`, { method: 'POST', body, headers })).status, 401, 'a replayed request is refused');

    const path = `/runs/${JSON.parse(body).id}`;
    const stale = signRunnerRequest(SECRET, 'GET', path, '', Math.floor(Date.now() / 1000) - 600);
    assert.equal((await fetch(`${base}${path}`, { headers: stale })).status, 401, 'an old timestamp is refused');
    assert.equal((await fetch(`${base}${path}`, { headers: signRunnerRequest(SECRET, 'GET', path) })).status, 200);
    assert.equal((await fetch(`${base}/health`)).status, 200);
  } finally {
    await runner.stop();
  }
});
