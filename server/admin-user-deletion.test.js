import assert from 'node:assert/strict';
import test from 'node:test';
import { normaliseUserDeletionIds, userDeletionTombstones } from './lib/admin-user-deletion.js';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';

test('bulk account deletion accepts unique UUIDs only', () => {
  assert.deepEqual(normaliseUserDeletionIds([first, second, first]), [first, second]);
  assert.throws(() => normaliseUserDeletionIds([]), /Select between 1 and 100/);
  assert.throws(() => normaliseUserDeletionIds(['not-an-id']), /Select between 1 and 100/);
  assert.throws(() => normaliseUserDeletionIds('all'), /must be an array/);
});

test('deleted user tombstones keep stable identifiers for restore suppression', () => {
  const rows = userDeletionTombstones([
    { id: first, email: 'User@Example.COM', role: 'user' },
    { id: second, email: 'Admin@Example.COM', role: 'admin' },
  ], { id: '99999999-9999-4999-8999-999999999999', email: 'owner@example.com' });
  assert.deepEqual(rows, [
    { user_id: first, user_email: 'user@example.com', user_role: 'user', deleted_by_id: '99999999-9999-4999-8999-999999999999', deleted_by_email: 'owner@example.com' },
    { user_id: second, user_email: 'admin@example.com', user_role: 'admin', deleted_by_id: '99999999-9999-4999-8999-999999999999', deleted_by_email: 'owner@example.com' },
  ]);
});
