#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createAdminAiExecutor, DEFAULT_ADMIN_AI_ACTOR } from './admin-ai.js';

function actorFromEnvironment() {
  return {
    ...DEFAULT_ADMIN_AI_ACTOR,
    id: process.env.ADMIN_AI_ACTOR_ID || DEFAULT_ADMIN_AI_ACTOR.id,
    email: process.env.ADMIN_AI_ACTOR_EMAIL || DEFAULT_ADMIN_AI_ACTOR.email,
    full_name: process.env.ADMIN_AI_ACTOR_NAME || DEFAULT_ADMIN_AI_ACTOR.full_name,
    role: 'admin',
  };
}

function readInput() {
  const inline = process.argv.slice(2).join(' ').trim();
  if (inline) return inline;
  return readFileSync(0, 'utf8');
}

async function main() {
  const executor = createAdminAiExecutor({ actor: actorFromEnvironment() });
  const result = await executor.run(readInput());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.success) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ success: false, error: error.message || 'Admin AI command failed' }, null, 2)}\n`);
  process.exitCode = 1;
});
