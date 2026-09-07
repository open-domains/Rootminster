import assert from 'node:assert/strict';
import test from 'node:test';
import { normaliseUserDeletionIds } from './lib/admin-user-deletion.js';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';

test('bulk account deletion accepts unique UUIDs only', () => {
  assert.deepEqual(normaliseUserDeletionIds([first, second, first]), [first, second]);
  assert.throws(() => normaliseUserDeletionIds([]), /Select between 1 and 100/);
  assert.throws(() => normaliseUserDeletionIds(['not-an-id']), /Select between 1 and 100/);
  assert.throws(() => normaliseUserDeletionIds('all'), /must be an array/);
});
