/**
 * Regression tests for function-runner HTTP error handling.
 *
 * ROOTMINSTER-1R: manageDnsRecord (and other functions) return 502 when
 * Cloudflare API calls fail. The function-runner must pass those responses
 * through to the client with the original error body — not replace them with
 * "Internal server error" and not capture them to GlitchTip as Rootminster bugs.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('function-runner only captures status 500 (not 502) as an internal server error', async () => {
  const src = await readFile(new URL('./function-runner.js', import.meta.url), 'utf8');

  // The fix: condition must NOT match 502 responses.
  // Using >= 500 swallows intentional 502 upstream-failure responses from
  // functions like manageDnsRecord, replacing the useful CF error message
  // with the generic "Internal server error" and flooding GlitchTip with
  // noise that is not a Rootminster bug (ROOTMINSTER-1R).
  assert.doesNotMatch(
    src,
    /response\.status\s*>=\s*500/,
    'function-runner must not use >= 500; that discards intentional 502 upstream-failure responses',
  );

  // The fix: condition must only capture genuine internal server errors.
  assert.match(
    src,
    /response\.status\s*===\s*500/,
    'function-runner must use === 500 so 502 upstream failures are passed through with original body',
  );
});

test('manageDnsRecord returns 502 for Cloudflare upstream failures with descriptive error body', async () => {
  const src = await readFile(new URL('./functions/manageDnsRecord.js', import.meta.url), 'utf8');

  // The function intentionally uses 502 for upstream CF failures.
  assert.match(
    src,
    /status:\s*502/,
    'manageDnsRecord must return 502 for Cloudflare upstream failures',
  );

  // Those 502 responses must carry a descriptive error message, not the
  // generic "Internal server error" placeholder.
  assert.match(
    src,
    /Cloudflare (create|update|delete) failed/,
    'manageDnsRecord must include Cloudflare-specific error text in 502 responses',
  );
});
