import test from 'node:test';
import assert from 'node:assert/strict';
import { isReservedName } from './request-policy.js';

test('reserved names match case-insensitively', () => {
  assert.equal(isReservedName('Admin', ['admin']), true);
  assert.equal(isReservedName('user', ['admin']), false);
});

test('reserved names support wildcard rules', () => {
  assert.equal(isReservedName('status-prod', ['status-*']), true);
  assert.equal(isReservedName('foo.internal', ['*.internal']), true);
  assert.equal(isReservedName('internal.example', ['*.internal']), false);
});

test('a star reserves every name', () => {
  assert.equal(isReservedName('anything', ['*']), true);
});
