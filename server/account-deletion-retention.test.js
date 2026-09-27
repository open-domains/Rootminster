import assert from 'node:assert/strict';
import test from 'node:test';
import { purgeApprovedAccountDeletionRequests } from './lib/account-deletion-retention.js';

test('purges approved account deletion requests 30 days after decision', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 2 };
    },
  };

  const result = await purgeApprovedAccountDeletionRequests(db);

  assert.equal(result.deleted, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [30]);
  assert.match(calls[0].sql, /DELETE FROM account_deletion_requests/);
  assert.match(calls[0].sql, /status = 'approved'/);
  assert.match(calls[0].sql, /decided_at <= now\(\) - \(\$1 \|\| ' days'\)::interval/);
});
