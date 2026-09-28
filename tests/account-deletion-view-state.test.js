import assert from 'node:assert/strict';
import test from 'node:test';

import { deletionRequestViewState } from '../src/lib/account-deletion-view-state.js';

test('shows account deletion request form when no request exists', () => {
  assert.deepEqual(deletionRequestViewState(null), {
    hasPendingRequest: false,
    status: '',
    decisionReason: '',
    requestedAt: '',
  });
});

test('shows pending account deletion request details when a request exists', () => {
  assert.deepEqual(deletionRequestViewState({
    status: 'pending',
    requested_at: '2026-09-28T02:54:33.209Z',
    decision_reason: null,
  }), {
    hasPendingRequest: true,
    status: 'pending',
    decisionReason: '',
    requestedAt: '9/28/2026, 2:54:33 AM',
  });
});
