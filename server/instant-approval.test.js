import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateInstantApproval,
  recheckInstantApprovals,
  revokeInstantApproval,
  tryInstantApproval,
} from './lib/instant-approval.js';
import { pool } from './database.js';
import { invokeInternal } from './function-runner.js';

const SETTINGS = {
  enabled: true,
  allowed_record_types: 'A, AAAA, CNAME, TXT',
  min_account_age_days: 1,
  max_per_account_per_day: 1,
  max_per_day: 50,
  recheck_minutes: 30,
  monitoring_days: 14,
  revoke_severity: 'critical',
};
const NOW = new Date('2026-11-01T12:00:00Z');
const USER = { id: 'u1', email: 'owner@example.test', role: 'user', created_date: '2026-10-01T00:00:00Z' };
const CLEAR_OBSERVER = { status: 'clear', severity: 'clear', score: 0, finding_count: 0 };
const CLEAR_RISK = { score: 10, verdict: 'clear', signals: [{ code: 'new_account', label: 'New account', score: 10, severity: 'low' }] };
const REQUEST = {
  id: 'req1', requester_id: 'u1', requester_email: USER.email, subdomain: 'site', root_domain: 'example.test',
  full_name: 'site.example.test', status: 'pending', zone_id: 'zone1', preview_link: 'https://preview.example.org',
  record_type: 'CNAME', record_value: 'owner.github.io', records: [{ record_type: 'CNAME', record_value: 'owner.github.io', ttl: 3600, proxied: false }],
};

const decide = (overrides = {}) => evaluateInstantApproval({
  settings: SETTINGS, observerEnabled: true, observer: CLEAR_OBSERVER, risk: CLEAR_RISK,
  request: REQUEST, user: USER, history: [], approvedToday: 0, now: NOW, ...overrides,
});

test('a clean request from an established account is approved instantly', () => {
  const result = decide();
  assert.equal(result.approve, true);
  assert.ok(result.reasons.some(reason => reason.includes('Observer found no issues')));
});

test('anything Observer did not clear goes to staff review', () => {
  assert.equal(decide({ observerEnabled: false }).approve, false);
  assert.equal(decide({ observer: null }).approve, false);
  assert.equal(decide({ observer: { error: 'timeout' } }).approve, false);
  const flagged = decide({ observer: { status: 'flagged', severity: 'high', finding_count: 2 } });
  assert.equal(flagged.approve, false);
  assert.match(flagged.reasons[0], /high severity, 2 finding/);
});

test('record types outside the allow-list go to staff review', () => {
  const ns = { ...REQUEST, record_type: 'NS', records: [{ record_type: 'NS', record_value: 'ns1.example.org' }] };
  const result = decide({ request: ns });
  assert.equal(result.approve, false);
  assert.match(result.reasons.join(' '), /Record type NS/);
});

test('risky signals, young accounts and earlier pull-backs block instant approval', () => {
  assert.equal(decide({ risk: { score: 35, verdict: 'review', signals: [] } }).approve, false);
  assert.equal(decide({ risk: { score: 25, verdict: 'clear', signals: [{ label: 'Protected brand', severity: 'high' }] } }).approve, false);
  assert.equal(decide({ risk: null }).approve, false);
  assert.equal(decide({ user: { ...USER, created_date: '2026-11-01T06:00:00Z' } }).approve, false);
  assert.equal(decide({ user: { ...USER, created_date: undefined } }).approve, false);
  assert.equal(decide({ history: [{ safety_auto_decision: 'revoked' }] }).approve, false);
});

test('per-account and daily caps send extra requests to staff', () => {
  const today = { safety_auto_decision: 'approved', safety_auto_decided_at: '2026-11-01T01:00:00Z' };
  const yesterday = { safety_auto_decision: 'approved', safety_auto_decided_at: '2026-10-31T23:00:00Z' };
  assert.equal(decide({ history: [today] }).approve, false);
  assert.equal(decide({ history: [yesterday] }).approve, true);
  assert.equal(decide({ approvedToday: 50 }).approve, false);
  assert.equal(decide({ approvedToday: 49 }).approve, true);
});

function makeEntityApi(seed = []) {
  const rows = seed.map(row => ({ ...row }));
  let nextId = 1;
  const matches = (row, filter = {}) => Object.entries(filter).every(([key, value]) =>
    value && typeof value === 'object' && Array.isArray(value.$in) ? value.$in.includes(row[key]) : row[key] === value);
  return {
    rows,
    async list() { return rows.map(row => ({ ...row })); },
    async filter(filter) { return rows.filter(row => matches(row, filter)).map(row => ({ ...row })); },
    async get(id) { const row = rows.find(item => item.id === id); return row ? { ...row } : null; },
    async create(data) { const row = { id: `new-${nextId++}`, created_date: NOW.toISOString(), ...data }; rows.push(row); return { ...row }; },
    async update(id, data) { const row = rows.find(item => item.id === id); if (!row) throw new Error(`Missing ${id}`); Object.assign(row, data); return { ...row }; },
    async delete(id) { const index = rows.findIndex(item => item.id === id); return index === -1 ? null : rows.splice(index, 1)[0]; },
  };
}

function makePlatform({ requests = [], records = [], ownerships = [] } = {}) {
  const entities = Object.fromEntries(['SubdomainRequest', 'DnsRecord', 'SubdomainOwnership', 'Domain', 'AuditLog', 'EmailLog', 'PlatformSettings']
    .map(name => [name, makeEntityApi({ SubdomainRequest: requests, DnsRecord: records, SubdomainOwnership: ownerships, Domain: [{ id: 'd1', name: 'example.test', zone_id: 'zone1' }] }[name] || [])]));
  const emails = [];
  const platform = { asServiceRole: { entities, integrations: { Core: { SendEmail: async message => { emails.push(message); } } } } };
  return { platform, entities, emails };
}

function makeCloudflare() {
  const calls = [];
  let nextId = 1;
  const cfFetch = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === 'GET') return { success: true, result: [], result_info: { total_pages: 1 } };
    if (method === 'POST') return { success: true, result: { id: `cf-${nextId++}`, ttl: body.ttl, ...body } };
    if (method === 'DELETE') return { success: true };
    return { success: false };
  };
  return { calls, cfFetch };
}

const noLockedHelpers = t => t.mock.method(pool, 'connect', async () => ({ query: async () => ({ rows: [{ locked: true }] }), release() {} }));

test('instant approval provisions DNS, records the decision and schedules a re-scan', async () => {
  const { platform, entities, emails } = makePlatform({ requests: [REQUEST] });
  const cloudflare = makeCloudflare();
  const result = await tryInstantApproval(platform, { ...REQUEST }, USER, CLEAR_OBSERVER, {
    settings: SETTINGS, observerSettings: { enabled: true }, now: NOW, cfFetch: cloudflare.cfFetch,
    storeImpl: { requestsWithTargets: async () => [] },
  });

  assert.equal(result.decision, 'approved');
  assert.ok(cloudflare.calls.some(call => call.method === 'POST' && call.body.content === 'owner.github.io'));
  const saved = entities.SubdomainRequest.rows[0];
  assert.equal(saved.status, 'approved');
  assert.equal(saved.reviewed_by, 'Instant approval');
  assert.equal(saved.safety_auto_decision, 'approved');
  assert.equal(saved.safety_auto_next_check_at, '2026-11-01T12:30:00.000Z');
  assert.equal(saved.safety_auto_monitor_until, '2026-11-15T12:00:00.000Z');
  assert.equal(entities.DnsRecord.rows.length, 1);
  assert.ok(entities.AuditLog.rows.some(row => row.action === 'instant_approval_granted'));
  assert.equal(emails.length, 1);
});

test('a declined request stays pending with its reasons recorded for staff', async () => {
  const { platform, entities } = makePlatform({ requests: [REQUEST] });
  const cloudflare = makeCloudflare();
  const result = await tryInstantApproval(platform, { ...REQUEST }, USER, { status: 'flagged', severity: 'high', finding_count: 1 }, {
    settings: SETTINGS, observerSettings: { enabled: true }, now: NOW, cfFetch: cloudflare.cfFetch,
    storeImpl: { requestsWithTargets: async () => [] },
  });
  assert.equal(result.decision, 'manual');
  assert.equal(cloudflare.calls.length, 0);
  const saved = entities.SubdomainRequest.rows[0];
  assert.equal(saved.status, 'pending');
  assert.equal(saved.safety_auto_decision, 'manual');
  assert.ok(entities.AuditLog.rows.some(row => row.action === 'instant_approval_declined'));
});

test('instant approval does nothing while the module is disabled', async () => {
  const { platform, entities } = makePlatform({ requests: [REQUEST] });
  const result = await tryInstantApproval(platform, { ...REQUEST }, USER, CLEAR_OBSERVER, { settings: { ...SETTINGS, enabled: false } });
  assert.equal(result.decision, 'disabled');
  assert.equal(entities.SubdomainRequest.rows[0].safety_auto_decision, undefined);
  assert.equal(entities.AuditLog.rows.length, 0);
});

const LIVE = {
  ...REQUEST, status: 'approved', safety_auto_decision: 'approved',
  safety_auto_next_check_at: '2026-11-01T11:30:00Z', safety_auto_monitor_until: '2026-11-15T12:00:00Z',
  records: [{ ...REQUEST.records[0], cloudflare_record_id: 'cf-1', dns_record_id: 'dns1' }],
};
const LIVE_RECORD = { id: 'dns1', name: 'site.example.test', zone_id: 'zone1', zone_name: 'example.test', cloudflare_record_id: 'cf-1', record_type: 'CNAME', content: 'owner.github.io', owner_id: 'u1', owner_email: USER.email, managed: true, status: 'active' };

test('a critical finding on the live site pulls the request back to review', async t => {
  noLockedHelpers(t);
  const { platform, entities, emails } = makePlatform({ requests: [LIVE], records: [LIVE_RECORD] });
  const cloudflare = makeCloudflare();
  const summary = await recheckInstantApprovals(platform, {
    settings: SETTINGS, now: NOW, cfFetch: cloudflare.cfFetch,
    scan: async () => ({ policy_result: { severity: 'critical', findings: [{ policy_section: '9. Spam and Deceptive Activity' }] } }),
  });

  assert.deepEqual(summary, { checked: 1, clear: 0, revoked: 1, failed: 0 });
  assert.ok(cloudflare.calls.some(call => call.method === 'DELETE' && call.path === '/zones/zone1/dns_records/cf-1'));
  assert.equal(entities.DnsRecord.rows.length, 0);
  const saved = entities.SubdomainRequest.rows[0];
  assert.equal(saved.status, 'pending');
  assert.equal(saved.safety_auto_decision, 'revoked');
  assert.equal(saved.records[0].cloudflare_record_id, undefined);
  assert.equal(saved.records[0].record_value, 'owner.github.io');
  assert.match(saved.admin_notes, /Spam and Deceptive Activity/);
  const revoked = entities.AuditLog.rows.find(row => row.action === 'instant_approval_revoked');
  assert.match(revoked.old_value, /owner\.github\.io/);
  assert.equal(emails.length, 1);
});

test('findings below the pull-back threshold keep the site live and schedule the next scan', async t => {
  noLockedHelpers(t);
  const { platform, entities } = makePlatform({ requests: [LIVE], records: [LIVE_RECORD] });
  const summary = await recheckInstantApprovals(platform, {
    settings: SETTINGS, now: NOW, cfFetch: makeCloudflare().cfFetch,
    scan: async () => ({ policy_result: { severity: 'high', findings: [{ policy_section: '6.4 Commercial Use' }] } }),
  });
  assert.equal(summary.clear, 1);
  const saved = entities.SubdomainRequest.rows[0];
  assert.equal(saved.status, 'approved');
  assert.equal(saved.safety_auto_next_check_at, '2026-11-02T12:00:00.000Z');
  assert.match(saved.safety_auto_last_check_result, /below pull-back threshold/);
  assert.equal(entities.DnsRecord.rows.length, 1);
});

test('re-scans skip requests that are not due or past monitoring, and retry failed scans', async t => {
  noLockedHelpers(t);
  const notDue = { ...LIVE, id: 'r2', safety_auto_next_check_at: '2026-11-01T13:00:00Z' };
  const expired = { ...LIVE, id: 'r3', safety_auto_monitor_until: '2026-11-01T00:00:00Z' };
  const failing = { ...LIVE, id: 'r4' };
  const { platform, entities } = makePlatform({ requests: [notDue, expired, failing] });
  const scanned = [];
  const summary = await recheckInstantApprovals(platform, {
    settings: SETTINGS, now: NOW,
    scan: async target => { scanned.push(target.full_name); throw new Error('Observer down'); },
  });
  assert.deepEqual(summary, { checked: 1, clear: 0, revoked: 0, failed: 1 });
  assert.equal(scanned.length, 1);
  const retried = entities.SubdomainRequest.rows.find(row => row.id === 'r4');
  assert.equal(retried.safety_auto_next_check_at, '2026-11-01T12:30:00.000Z');
  assert.equal(retried.status, 'approved');
});

test('staff pull-back keeps the records so the request can be approved again', async () => {
  const { platform, entities } = makePlatform({ requests: [LIVE], records: [LIVE_RECORD, { ...LIVE_RECORD, id: 'other', owner_id: 'someone-else', cloudflare_record_id: 'cf-9' }] });
  const cloudflare = makeCloudflare();
  const { removed } = await revokeInstantApproval(platform, { ...LIVE }, {
    reason: 'Staff: looks like phishing', actor: { email: 'staff@example.test', role: 'staff' }, cfFetch: cloudflare.cfFetch, now: NOW,
  });
  assert.equal(removed.length, 1);
  assert.deepEqual(entities.DnsRecord.rows.map(row => row.id), ['other']);
  const saved = entities.SubdomainRequest.rows[0];
  assert.equal(saved.status, 'pending');
  assert.equal(saved.records.length, 1);
  assert.equal(entities.AuditLog.rows.find(row => row.action === 'instant_approval_revoked').actor_email, 'staff@example.test');
});

test('only staff and admins can pull an instant approval back to review', async () => {
  for (const role of ['user', 'domain_provider']) {
    await assert.rejects(
      invokeInternal('manageInstantApproval', { action: 'revoke', request_id: 'req1', reason: 'x' }, { id: 'u1', email: USER.email, role }),
      error => error.status === 403,
    );
  }
  await assert.rejects(invokeInternal('instantApprovalRecheck', {}, { id: 's1', email: 'staff@example.test', role: 'staff' }), error => error.status === 403);
});
