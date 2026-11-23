import test from 'node:test';
import assert from 'node:assert/strict';
import { describeCountdown } from '../src/lib/countdown.js';

const NOW = Date.parse('2026-11-23T12:00:00Z');

test('countdowns read as days and hours, then hours, then minutes', () => {
  assert.equal(describeCountdown(NOW + (12 * 24 + 4) * 3_600_000, NOW), 'in 12 days, 4 hours');
  assert.equal(describeCountdown(NOW + 24 * 3_600_000, NOW), 'in 1 day');
  assert.equal(describeCountdown(NOW + 5 * 3_600_000, NOW), 'in 5 hours');
  assert.equal(describeCountdown(NOW + 90_000, NOW), 'in 1 minute');
});

test('past or invalid times do not show a negative countdown', () => {
  assert.equal(describeCountdown(NOW - 1, NOW), 'Due on the next run');
  assert.equal(describeCountdown('not a date', NOW), '—');
});
