import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findNamespaceConflictIn,
  inferBaseName,
  isLiveManagedRecord,
  listAllEntities,
  reconcileSubdomainOwnerships,
  resolveOwnershipBase,
  syncOwnershipForNamespace,
} from './lib/subdomain-ownership.js';

function makeEntityApi(seed = []) {
  const rows = seed.map(row => ({ ...row }));
  let nextId = rows.length + 1;
  const matches = (row, filter = {}) => Object.entries(filter).every(([key, value]) => row[key] === value);
  const sortRows = (items, sort = 'id') => {
    const desc = String(sort || '').startsWith('-');
    const field = String(sort || 'id').replace(/^-/, '');
    return [...items].sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * (desc ? -1 : 1));
  };
  return {
    rows,
    async list(sort, limit = 1000, skip = 0) {
      return sortRows(rows, sort).slice(skip, skip + limit).map(row => ({ ...row }));
    },
    async filter(filter, sort, limit = 1000, skip = 0) {
      return sortRows(rows.filter(row => matches(row, filter)), sort).slice(skip, skip + limit).map(row => ({ ...row }));
    },
    async create(data) {
      const row = { id: `new-${nextId++}`, created_date: new Date().toISOString(), ...data };
      rows.push(row);
      return { ...row };
    },
    async update(id, data) {
      const row = rows.find(item => item.id === id);
      if (!row) throw new Error(`Missing row ${id}`);
      Object.assign(row, data);
      return { ...row };
    },
    async delete(id) {
      const index = rows.findIndex(item => item.id === id);
      if (index === -1) return null;
      return rows.splice(index, 1)[0];
    },
  };
}

function makePlatform({ ownerships = [], records = [], requests = [], domains = [] } = {}) {
  const entities = {
    SubdomainOwnership: makeEntityApi(ownerships),
    DnsRecord: makeEntityApi(records),
    SubdomainRequest: makeEntityApi(requests),
    Domain: makeEntityApi(domains),
    AuditLog: makeEntityApi(),
  };
  return { platform: { asServiceRole: { entities } }, entities };
}

test('managed records without legacy status are still live DNS', () => {
  assert.equal(isLiveManagedRecord({ managed: true }), true);
  assert.equal(isLiveManagedRecord({ managed: true, status: 'active' }), true);
  assert.equal(isLiveManagedRecord({ managed: true, status: 'suspended' }), false);
  assert.equal(isLiveManagedRecord({ managed: false, status: 'active' }), false);
});

test('base inference does not turn service labels into owned subdomains', () => {
  assert.equal(
    inferBaseName({ name: '_dmarc.project-pilot.is-local.org', zone_name: 'is-local.org' }),
    'project-pilot.is-local.org',
  );
});

test('explicit request linkage resolves verification records outside the subdomain namespace', async () => {
  const record = {
    id: 'dns-gh', owner_id: 'u1', owner_email: 'u@example.com', managed: true, status: 'active',
    name: '_github-pages-challenge-arbotixcodez.is-local.org', zone_name: 'is-local.org',
  };
  const { platform } = makePlatform({
    ownerships: [
      { id: 'parent', owner_id: 'u1', owner_email: 'u@example.com', full_name: 'arbotixcodez.is-local.org' },
    ],
    records: [record],
    requests: [
      {
        id: 'r2', status: 'approved', requester_id: 'u1', requester_email: 'u@example.com',
        subdomain: 'arbotixcodez', root_domain: 'is-local.org', dns_record_id: 'dns-gh',
      },
    ],
  });
  const base = await resolveOwnershipBase(
    platform,
    { id: 'u1', email: 'u@example.com' },
    record.name,
    null,
    record.zone_name,
  );
  assert.equal(base, 'arbotixcodez.is-local.org');
});

test('entity scans paginate past the per-page ceiling', async () => {
  const api = makeEntityApi(Array.from({ length: 10_005 }, (_, index) => ({ id: String(index).padStart(6, '0') })));
  const rows = await listAllEntities(api);
  assert.equal(rows.length, 10_005);
  assert.equal(rows[0].id, '000000');
  assert.equal(rows.at(-1).id, '010004');
});

test('approved request boundary wins over an exact DNS hostname', async () => {
  const { platform } = makePlatform({
    ownerships: [
      { id: 'parent', owner_id: 'u1', owner_email: 'u@example.com', full_name: 'project-pilot.is-local.org' },
      { id: 'bad-child', owner_id: 'u1', owner_email: 'u@example.com', full_name: '_dmarc.project-pilot.is-local.org' },
    ],
    requests: [
      { id: 'r1', status: 'approved', requester_id: 'u1', requester_email: 'u@example.com', subdomain: 'project-pilot', root_domain: 'is-local.org' },
    ],
  });
  const base = await resolveOwnershipBase(
    platform,
    { id: 'u1', email: 'u@example.com' },
    '_dmarc.project-pilot.is-local.org',
  );
  assert.equal(base, 'project-pilot.is-local.org');
});

test('reconciliation claims strongly linked legacy DNS rows before status evaluation', async () => {
  const { platform, entities } = makePlatform({
    ownerships: [
      {
        id: 'parent-legacy', owner_id: 'u1', owner_email: 'u@example.com',
        full_name: 'legacy.is-local.org', subdomain: 'legacy', root_domain: 'is-local.org',
        status: 'suspended', suspended_at: '2026-09-01T00:00:00.000Z',
      },
    ],
    records: [
      {
        id: 'legacy-dns', managed: false, name: 'legacy.is-local.org', zone_name: 'is-local.org',
        zone_id: 'zone1', record_type: 'A', content: '203.0.113.10',
      },
    ],
    requests: [
      {
        id: 'legacy-request', status: 'approved', requester_id: 'u1', requester_email: 'u@example.com',
        subdomain: 'legacy', root_domain: 'is-local.org', dns_record_id: 'legacy-dns',
      },
    ],
    domains: [{ id: 'domain1', name: 'is-local.org', zone_id: 'zone1' }],
  });

  const result = await reconcileSubdomainOwnerships(platform, {
    now: new Date('2026-09-20T12:00:00.000Z'),
    auditActor: null,
  });

  assert.equal(result.stats.dns_records_claimed, 1);
  assert.equal(entities.DnsRecord.rows[0].managed, true);
  assert.equal(entities.DnsRecord.rows[0].owner_id, 'u1');
  assert.equal(entities.DnsRecord.rows[0].status, 'active');
  assert.equal(entities.SubdomainOwnership.rows.find(row => row.id === 'parent-legacy').status, 'active');
});

test('reconciliation does not recreate cleaned-up approved namespaces without DNS records', async () => {
  const { platform, entities } = makePlatform({
    requests: [
      {
        id: 'request-empty', status: 'approved', requester_id: 'u1', requester_email: 'u@example.com',
        subdomain: 'empty', root_domain: 'is-local.org', full_name: 'empty.is-local.org',
      },
    ],
    domains: [{ id: 'domain1', name: 'is-local.org', zone_id: 'zone1' }],
  });

  const result = await reconcileSubdomainOwnerships(platform, {
    now: new Date('2026-09-20T12:00:00.000Z'),
    auditActor: null,
  });

  assert.equal(result.stats.ownerships_created, 0);
  assert.equal(entities.SubdomainOwnership.rows.length, 0);
});

test('reconciliation repairs false suspension and removes proven stray child ownership', async () => {
  const { platform, entities } = makePlatform({
    ownerships: [
      {
        id: 'parent', created_date: '2026-01-01T00:00:00.000Z',
        owner_id: 'u1', owner_email: 'u@example.com',
        full_name: 'project-pilot.is-local.org', subdomain: 'project-pilot', root_domain: 'is-local.org',
        status: 'suspended', suspended_at: '2026-09-01T00:00:00.000Z', suspension_reason: 'No DNS records remain',
      },
      {
        id: 'bad-child', created_date: '2026-09-02T00:00:00.000Z',
        owner_id: 'u1', owner_email: 'u@example.com',
        full_name: '_dmarc.project-pilot.is-local.org', subdomain: '_dmarc.project-pilot', root_domain: 'is-local.org',
        status: 'suspended', suspended_at: '2026-09-02T00:00:00.000Z', suspension_reason: 'No DNS records remain',
      },
    ],
    records: [
      {
        id: 'dns1', owner_id: 'u1', owner_email: 'u@example.com', managed: true,
        name: '_dmarc.project-pilot.is-local.org', zone_name: 'is-local.org', zone_id: 'zone1', record_type: 'TXT', content: 'v=DMARC1',
      },
    ],
    requests: [
      {
        id: 'request1', status: 'approved', requester_id: 'u1', requester_email: 'u@example.com',
        subdomain: 'project-pilot', root_domain: 'is-local.org', full_name: 'project-pilot.is-local.org',
      },
    ],
    domains: [{ id: 'domain1', name: 'is-local.org', zone_id: 'zone1' }],
  });

  const result = await reconcileSubdomainOwnerships(platform, {
    now: new Date('2026-09-20T12:00:00.000Z'),
    auditActor: null,
  });

  assert.equal(result.stats.normalized_dns_records, 1);
  assert.equal(result.stats.activated, 1);
  assert.equal(result.stats.stray_children_removed, 1);
  assert.equal(entities.DnsRecord.rows[0].status, 'active');
  assert.equal(entities.SubdomainOwnership.rows.find(row => row.id === 'parent').status, 'active');
  assert.equal(entities.SubdomainOwnership.rows.some(row => row.id === 'bad-child'), false);
});

test('namespace conflicts cover another owner on the same name, a parent, and children', () => {
  const victim = { owner_id: 'victim', owner_email: 'victim@example.test' };
  const rows = {
    ownerships: [
      { ...victim, full_name: 'team.example.test' },
      { owner_id: 'me', owner_email: 'me@example.test', full_name: 'mine.example.test' },
      { owner_id: 'apex', full_name: 'example.test' },
    ],
    records: [{ ...victim, name: 'shared.mine.example.test', managed: true, status: 'active' }],
  };
  const me = { id: 'me', email: 'me@example.test' };
  const check = (name, includeDescendants = true) =>
    findNamespaceConflictIn(rows, me, name, { zoneName: 'example.test', includeDescendants })?.name || null;
  assert.equal(check('team.example.test'), 'team.example.test');
  assert.equal(check('api.team.example.test'), 'team.example.test');
  assert.equal(check('shared.mine.example.test'), 'shared.mine.example.test');
  assert.equal(check('mine.example.test'), 'shared.mine.example.test');
  assert.equal(check('mine.example.test', false), null);
  assert.equal(check('other.mine.example.test'), null);
  // Rows at the zone apex are not a namespace anyone can own.
  assert.equal(check('fresh.example.test'), null);
});

test('reconciliation never backfills a parent namespace over another account', async () => {
  const { platform, entities } = makePlatform({
    ownerships: [{ id: 'victim-grant', full_name: 'foo.is-local.org', root_domain: 'is-local.org', owner_id: 'victim', owner_email: 'victim@example.test', status: 'active' }],
    records: [
      { id: 'victim-record', name: 'foo.is-local.org', zone_name: 'is-local.org', owner_id: 'victim', owner_email: 'victim@example.test', managed: true, status: 'active' },
      { id: 'intruder-record', name: 'x.foo.is-local.org', zone_name: 'is-local.org', owner_id: 'intruder', owner_email: 'intruder@example.test', managed: true, status: 'active' },
    ],
  });
  const { stats } = await reconcileSubdomainOwnerships(platform, { auditActor: null });
  assert.equal(stats.namespace_conflicts_skipped, 1);
  assert.deepEqual(entities.SubdomainOwnership.rows.map(row => [row.owner_id, row.full_name]), [['victim', 'foo.is-local.org']]);
});

test('ownership sync will not create a namespace that overlaps another account', async () => {
  const { platform, entities } = makePlatform({
    ownerships: [{ id: 'victim-grant', full_name: 'deep.foo.is-local.org', root_domain: 'is-local.org', owner_id: 'victim', owner_email: 'victim@example.test', status: 'active' }],
    records: [{ id: 'mine', name: 'foo.is-local.org', zone_name: 'is-local.org', owner_id: 'me', owner_email: 'me@example.test', managed: true, status: 'active' }],
  });
  const result = await syncOwnershipForNamespace(platform, {
    owner: { id: 'me', email: 'me@example.test' },
    fullName: 'foo.is-local.org',
    zone: { name: 'is-local.org', zone_id: 'zone' },
  });
  assert.equal(result.ownership, null);
  assert.equal(result.conflict.name, 'deep.foo.is-local.org');
  assert.equal(entities.SubdomainOwnership.rows.length, 1);
});
