import assert from 'node:assert/strict';
import test from 'node:test';
import { normaliseRestoreOptions, restoreTablesForOptions } from './backup-service.js';

test('restore options default to full database restore', () => {
  assert.deepEqual(normaliseRestoreOptions(undefined), { mode: 'full', data_groups: ['all'] });
});

test('restore options accept unique selectable data groups', () => {
  assert.deepEqual(normaliseRestoreOptions({ data_groups: ['users', 'dns', 'users', 'requests'] }), {
    mode: 'selective',
    data_groups: ['users', 'dns', 'requests'],
  });
});

test('restore options reject empty or unknown selective groups', () => {
  assert.throws(() => normaliseRestoreOptions({ data_groups: [] }), /Choose at least one data group/);
  assert.throws(() => normaliseRestoreOptions({ data_groups: ['users', 'secrets'] }), /Unknown restore data group/);
});

test('restore table selection expands groups to database tables', () => {
  assert.deepEqual(restoreTablesForOptions({ mode: 'selective', data_groups: ['users', 'dns'] }), [
    'users',
    'account_deletion_requests',
    'deleted_user_tombstones',
    'entity_records',
  ]);
});
