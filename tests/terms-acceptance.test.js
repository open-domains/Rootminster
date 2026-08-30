import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeUser } from '../server/store.js';

test('serializeUser exposes accepted terms version', () => {
  const user = serializeUser({
    id: '123',
    email: 'test@example.com',
    full_name: 'Test User',
    display_name: 'Tester',
    role: 'user',
    status: 'active',
    email_verified_at: new Date('2024-01-01T00:00:00Z'),
    tos_accepted_at: new Date('2024-02-01T00:00:00Z'),
    tos_accepted_version: '2026-08',
    ns_unlocked: false,
    legacy_donor: false,
    disable_email_notifications: false,
    totp_secret: null,
    totp_enabled: false,
    metadata: {},
    created_at: new Date('2023-01-01T00:00:00Z'),
    updated_at: new Date('2024-02-01T00:00:00Z'),
  });

  assert.equal(user.tos_accepted_version, '2026-08');
});
