import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldIgnoreClientErrorEvent } from '../src/lib/client-error-filter.js';

function event(value, frames) {
  return { exception: { values: [{ type: 'TypeError', value, stacktrace: frames ? { frames } : undefined }] } };
}

test('filters handled browser translation DOM mutations', () => {
  assert.equal(shouldIgnoreClientErrorEvent(event("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.", [{}])), true);
  assert.equal(shouldIgnoreClientErrorEvent(event("Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.", [{}])), true);
});

test('filters known Turnstile internals while retaining other Turnstile failures', () => {
  assert.equal(shouldIgnoreClientErrorEvent(event('[Cloudflare Turnstile] Error: 300010.', [{}])), true);
  assert.equal(shouldIgnoreClientErrorEvent(event('[Cloudflare Turnstile] Error: 300030.', [{}])), true);
  assert.equal(shouldIgnoreClientErrorEvent(event('[Cloudflare Turnstile] Error: 110200.', [{}])), false);
});

test('filters only stackless browser network failures', () => {
  const message = 'NetworkError when attempting to fetch resource.';
  assert.equal(shouldIgnoreClientErrorEvent(event(message)), true);
  assert.equal(shouldIgnoreClientErrorEvent(event(message, [{}])), false);
  assert.equal(shouldIgnoreClientErrorEvent(event('API request failed with status 500')), false);
});

test('filters stackless Safari and Chromium fetch failures', () => {
  assert.equal(shouldIgnoreClientErrorEvent(event('Load failed')), true);
  assert.equal(shouldIgnoreClientErrorEvent(event('Failed to fetch')), true);
});

test('filters errors whose stack is entirely browser-extension code', () => {
  assert.equal(shouldIgnoreClientErrorEvent(event("Cannot read properties of undefined (reading 'M_ID')", [
    { filename: 'chrome-extension://example/executors/200.js' },
  ])), true);
});
