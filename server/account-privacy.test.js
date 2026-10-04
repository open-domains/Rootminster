import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountExportFileName,
  deletionRequiresManualReview,
  publicAccountExport,
} from './account-privacy.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'User@Example.com',
  full_name: 'Example User',
  role: 'user',
  status: 'active',
};

test('public account export includes user data but omits token secrets', () => {
  const exported = publicAccountExport(user, {
    generated_at: '2026-10-04T12:00:00.000Z',
    account: { id: user.id, email: user.email, full_name: user.full_name },
    subdomains: [{ full_name: 'demo.open-domains.com' }],
    dns_records: [{ name: 'demo.open-domains.com', type: 'A' }],
    requests: [{ id: 'request-1' }],
    request_comments: [{ message: 'hello' }],
    donations: [{ stripe_session_id: 'cs_test_123' }],
    abuse_reports: [{ reporter_email: 'user@example.com' }],
    api_tokens: [{ name: 'CLI', token_hash: 'secret-hash', token: 'secret-token', created_at: '2026-10-01' }],
    trusted_devices: [{ name: 'Laptop', token_hash: 'device-secret', created_at: '2026-10-01' }],
  });

  assert.equal(exported.export_subject.email, user.email);
  assert.equal(exported.generated_at, '2026-10-04T12:00:00.000Z');
  assert.deepEqual(exported.data.subdomains, [{ full_name: 'demo.open-domains.com' }]);
  assert.equal(exported.data.api_tokens[0].name, 'CLI');
  assert.equal(exported.data.api_tokens[0].token_hash, undefined);
  assert.equal(exported.data.api_tokens[0].token, undefined);
  assert.equal(exported.data.trusted_devices[0].token_hash, undefined);
});

test('account export filenames are stable and safe', () => {
  assert.equal(accountExportFileName({ email: 'Example.User+test@Example.com' }, new Date('2026-10-04T12:00:00Z')), 'open-domains-data-example-user-test-example-com-2026-10-04.json');
});

test('deletion only needs manual review when account has active subdomain ownership', () => {
  assert.equal(deletionRequiresManualReview({ subdomains: [], dns_records: [] }), false);
  assert.equal(deletionRequiresManualReview({ subdomains: [{ status: 'active', full_name: 'demo.open-domains.com' }] }), true);
  assert.equal(deletionRequiresManualReview({ subdomains: [{ status: 'suspended', full_name: 'old.open-domains.com' }] }), false);
});
