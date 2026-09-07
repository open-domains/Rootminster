import assert from 'node:assert/strict';
import test from 'node:test';
import { backupDue } from './backup-service.js';

test('daily backups run once after the configured UTC hour', () => {
  const now = new Date('2026-09-07T03:15:00Z');
  assert.equal(backupDue('daily', null, now, 2), true);
  assert.equal(backupDue('daily', '2026-09-07T02:01:00Z', now, 2), false);
  assert.equal(backupDue('daily', '2026-09-06T02:01:00Z', new Date('2026-09-07T01:59:00Z'), 2), false);
});

test('weekly backups honor the selected weekday', () => {
  const sunday = new Date('2026-09-06T04:00:00Z');
  assert.equal(backupDue('weekly', '2026-08-30T04:00:00Z', sunday, 2, 0), true);
  assert.equal(backupDue('weekly', null, sunday, 2, 1), false);
  assert.equal(backupDue('manual', null, sunday, 2, 0), false);
});
