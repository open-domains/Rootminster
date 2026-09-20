const PAGE_SIZE = 10_000;
const MAX_ROWS = 250_000;

export function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\.+$/, '');
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function hostnameWithin(hostname, base) {
  const host = normalizeName(hostname);
  const namespace = normalizeName(base);
  return Boolean(host && namespace && (host === namespace || host.endsWith(`.${namespace}`)));
}

export function sameOwner(left, right) {
  if (!left || !right) return false;
  if (left.owner_id && right.owner_id) return left.owner_id === right.owner_id;
  const leftEmail = normalizeEmail(left.owner_email || left.requester_email || left.email);
  const rightEmail = normalizeEmail(right.owner_email || right.requester_email || right.email);
  return Boolean(leftEmail && rightEmail && leftEmail === rightEmail);
}

export function requestFullName(request) {
  return normalizeName(request?.full_name || (request?.subdomain && request?.root_domain
    ? `${request.subdomain}.${request.root_domain}`
    : ''));
}

export function isLiveManagedRecord(record) {
  return record?.managed === true && record?.status !== 'suspended';
}

export function inferBaseName(record) {
  const name = normalizeName(record?.name);
  const zone = normalizeName(record?.zone_name);
  if (!name || !zone || !name.endsWith(`.${zone}`)) return null;
  const relative = name.slice(0, -(zone.length + 1));
  const labels = relative.split('.').filter(Boolean);
  if (!labels.length) return null;
  return `${labels[labels.length - 1]}.${zone}`;
}

export async function listAllEntities(entityApi, filter = null, sort = 'id') {
  const rows = [];
  let skip = 0;
  for (;;) {
    const page = filter
      ? await entityApi.filter(filter, sort, PAGE_SIZE, skip)
      : await entityApi.list(sort, PAGE_SIZE, skip);
    if (!Array.isArray(page)) throw new Error('Entity API returned a non-array page');
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += page.length;
    if (skip >= MAX_ROWS) throw new Error(`Refusing to scan more than ${MAX_ROWS} rows in one reconciliation`);
  }
  return rows;
}

function ownerFilter(owner) {
  if (owner?.id) return { owner_id: owner.id };
  if (owner?.email) return { owner_email: owner.email };
  return null;
}

function requestBelongsToOwner(request, owner) {
  if (request?.requester_id && owner?.id) return request.requester_id === owner.id;
  const requestEmail = normalizeEmail(request?.requester_email);
  const ownerEmail = normalizeEmail(owner?.email || owner?.owner_email);
  return Boolean(requestEmail && ownerEmail && requestEmail === ownerEmail);
}

export async function resolveOwnershipBase(platform, owner, hostname, requestedBase = null, zoneName = null) {
  const host = normalizeName(hostname);
  const requested = normalizeName(requestedBase);
  if (!host) throw new Error('DNS record hostname is required');
  if (requested) {
    if (!hostnameWithin(host, requested)) throw new Error('The DNS record is outside the requested owned namespace');
    return requested;
  }

  const filter = ownerFilter(owner);
  const [ownerships, approvedRequests] = await Promise.all([
    filter ? listAllEntities(platform.asServiceRole.entities.SubdomainOwnership, filter) : [],
    listAllEntities(platform.asServiceRole.entities.SubdomainRequest, { status: 'approved' }),
  ]);

  const approvedMatches = approvedRequests
    .filter(request => requestBelongsToOwner(request, owner))
    .map(requestFullName)
    .filter(name => name && hostnameWithin(host, name))
    .sort((a, b) => b.length - a.length);
  if (approvedMatches.length) return approvedMatches[0];

  // Prefer the broadest existing owned namespace when no approved request establishes a
  // more specific boundary. This prevents a DNS hostname such as _dmarc.foo.example from
  // accidentally becoming its own SubdomainOwnership row.
  const ownershipMatches = ownerships
    .map(row => normalizeName(row.full_name))
    .filter(name => name && hostnameWithin(host, name))
    .sort((a, b) => a.length - b.length);
  if (ownershipMatches.length) return ownershipMatches[0];

  const zone = normalizeName(zoneName);
  if (zone) return inferBaseName({ name: host, zone_name: zone }) || host;
  return host;
}

export async function syncOwnershipForNamespace(platform, { owner, fullName, zone, now = new Date() }) {
  const full = normalizeName(fullName);
  const zoneName = normalizeName(zone?.name || zone?.zone_name || '');
  if (!full || !owner?.id || !owner?.email) return { ownership: null, status: null, recordCount: 0 };

  const [existing, ownerRecords] = await Promise.all([
    listAllEntities(platform.asServiceRole.entities.SubdomainOwnership, { owner_id: owner.id, full_name: full }),
    listAllEntities(platform.asServiceRole.entities.DnsRecord, { owner_id: owner.id, managed: true }),
  ]);
  const liveRecords = ownerRecords.filter(record => isLiveManagedRecord(record) && hostnameWithin(record.name, full));
  const active = liveRecords.length > 0;
  const nowIso = now.toISOString();
  const primary = existing[0];
  const payload = {
    full_name: full,
    subdomain: zoneName && full.endsWith(`.${zoneName}`) ? full.slice(0, -(zoneName.length + 1)) : full,
    root_domain: zoneName || primary?.root_domain || '',
    zone_id: zone?.zone_id || zone?.id || primary?.zone_id || '',
    owner_email: owner.email,
    owner_id: owner.id,
    status: active ? 'active' : 'suspended',
    suspended_at: active ? null : (primary?.suspended_at || nowIso),
    suspension_reason: active ? '' : 'No DNS records remain',
  };
  if (active && primary?.status === 'suspended') payload.last_record_added_at = nowIso;

  if (!existing.length) {
    const ownership = await platform.asServiceRole.entities.SubdomainOwnership.create(payload);
    return { ownership, status: payload.status, recordCount: liveRecords.length };
  }

  for (const row of existing) await platform.asServiceRole.entities.SubdomainOwnership.update(row.id, payload);
  return { ownership: { ...primary, ...payload }, status: payload.status, recordCount: liveRecords.length };
}

function canonicalRequestNames(approvedRequests, owner) {
  return approvedRequests
    .filter(request => requestBelongsToOwner(request, owner))
    .map(requestFullName)
    .filter(Boolean);
}

function ownershipKey(row) {
  const owner = row.owner_id || normalizeEmail(row.owner_email) || 'unknown';
  return `${owner}|${normalizeName(row.full_name)}`;
}

export async function reconcileSubdomainOwnerships(platform, { now = new Date(), auditActor = 'system' } = {}) {
  const entities = platform.asServiceRole.entities;
  const [ownershipRows, allRecords, approvedRequests, domains] = await Promise.all([
    listAllEntities(entities.SubdomainOwnership),
    listAllEntities(entities.DnsRecord),
    listAllEntities(entities.SubdomainRequest, { status: 'approved' }),
    listAllEntities(entities.Domain),
  ]);

  const nowIso = now.toISOString();
  const domainByName = new Map(domains.map(domain => [normalizeName(domain.name), domain]));
  const stats = {
    scanned_ownerships: ownershipRows.length,
    scanned_dns_records: allRecords.length,
    normalized_dns_records: 0,
    legacy_dns_records_deleted: 0,
    ownerships_created: 0,
    duplicates_removed: 0,
    stray_children_removed: 0,
    activated: 0,
    suspended: 0,
  };

  // Record-level suspension is legacy state. A managed DNS row that still exists is active
  // unless it is explicitly one of those legacy suspended rows, which are removed below.
  for (const record of allRecords) {
    if (!record.managed) continue;
    if (record.status === 'suspended') {
      await entities.DnsRecord.delete(record.id);
      record._removed = true;
      stats.legacy_dns_records_deleted++;
      continue;
    }
    if (record.status !== 'active') {
      await entities.DnsRecord.update(record.id, { status: 'active' });
      record.status = 'active';
      stats.normalized_dns_records++;
    }
  }

  const liveRecords = allRecords.filter(record => !record._removed && isLiveManagedRecord(record));
  const ownerships = ownershipRows.map(row => ({ ...row }));

  // Ensure every approved namespace has a durable ownership row. This is the strongest source
  // of truth for nested-subdomain boundaries.
  for (const request of approvedRequests) {
    const fullName = requestFullName(request);
    if (!fullName || !request.requester_id || !request.requester_email) continue;
    const exists = ownerships.some(row => row.owner_id === request.requester_id && normalizeName(row.full_name) === fullName);
    if (exists) continue;
    const domain = domainByName.get(normalizeName(request.root_domain));
    const hasRecords = liveRecords.some(record => record.owner_id === request.requester_id && hostnameWithin(record.name, fullName));
    const rootDomain = normalizeName(request.root_domain);
    const created = await entities.SubdomainOwnership.create({
      full_name: fullName,
      subdomain: request.subdomain || (rootDomain && fullName.endsWith(`.${rootDomain}`) ? fullName.slice(0, -(rootDomain.length + 1)) : fullName),
      root_domain: rootDomain,
      zone_id: domain?.zone_id || request.zone_id || '',
      owner_email: request.requester_email,
      owner_id: request.requester_id,
      status: hasRecords ? 'active' : 'suspended',
      suspended_at: hasRecords ? null : nowIso,
      suspension_reason: hasRecords ? '' : 'No DNS records remain',
      ...(hasRecords ? { last_record_added_at: nowIso } : {}),
    });
    ownerships.push(created);
    stats.ownerships_created++;
  }

  // Backfill a conservative base ownership for managed records that are not covered by any
  // existing/approved namespace. Approved requests win; otherwise use the root managed label.
  for (const record of liveRecords) {
    if (!record.owner_id || !record.owner_email) continue;
    const covered = ownerships.some(row => sameOwner(row, record) && hostnameWithin(record.name, row.full_name));
    if (covered) continue;
    const owner = { id: record.owner_id, email: record.owner_email };
    const approvedNames = canonicalRequestNames(approvedRequests, owner)
      .filter(name => hostnameWithin(record.name, name))
      .sort((a, b) => b.length - a.length);
    const fullName = approvedNames[0] || inferBaseName(record);
    if (!fullName) continue;
    const zoneName = normalizeName(record.zone_name);
    const created = await entities.SubdomainOwnership.create({
      full_name: fullName,
      subdomain: zoneName && fullName.endsWith(`.${zoneName}`) ? fullName.slice(0, -(zoneName.length + 1)) : fullName,
      root_domain: zoneName,
      zone_id: record.zone_id || domainByName.get(zoneName)?.zone_id || '',
      owner_email: record.owner_email,
      owner_id: record.owner_id,
      status: 'active',
      suspended_at: null,
      suspension_reason: '',
      last_record_added_at: nowIso,
    });
    ownerships.push(created);
    stats.ownerships_created++;
  }

  // Remove exact duplicate ownership rows first. Keep the oldest durable row.
  const groups = new Map();
  for (const row of ownerships) {
    const key = ownershipKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
    for (const duplicate of rows.slice(1)) {
      await entities.SubdomainOwnership.delete(duplicate.id);
      duplicate._removed = true;
      stats.duplicates_removed++;
    }
  }

  // Delete record-hostname ownerships only when an approved parent request proves the real
  // namespace boundary. This safely removes bad rows such as _dmarc.foo.example without
  // collapsing legitimate nested registrations.
  for (const row of ownerships) {
    if (row._removed || !row.owner_id) continue;
    const full = normalizeName(row.full_name);
    if (!full) continue;
    const owner = { id: row.owner_id, email: row.owner_email };
    const approvedNames = canonicalRequestNames(approvedRequests, owner);
    if (approvedNames.includes(full)) continue;
    const parent = approvedNames
      .filter(name => name !== full && hostnameWithin(full, name))
      .sort((a, b) => b.length - a.length)[0];
    if (!parent) continue;
    const exactDnsName = liveRecords.some(record => sameOwner(record, row) && normalizeName(record.name) === full);
    if (!exactDnsName) continue;
    await entities.SubdomainOwnership.delete(row.id);
    row._removed = true;
    stats.stray_children_removed++;
  }

  // Status is derived from the complete managed DNS scan, never from a truncated first page.
  for (const row of ownerships) {
    if (row._removed || !row.owner_id || !row.owner_email) continue;
    const full = normalizeName(row.full_name);
    if (!full) continue;
    const hasRecords = liveRecords.some(record => sameOwner(record, row) && hostnameWithin(record.name, full));
    const desired = hasRecords ? 'active' : 'suspended';
    const payload = {
      status: desired,
      suspended_at: hasRecords ? null : (row.suspended_at || nowIso),
      suspension_reason: hasRecords ? '' : 'No DNS records remain',
    };
    if (hasRecords && row.status === 'suspended') payload.last_record_added_at = nowIso;
    const needsUpdate = row.status !== desired ||
      (hasRecords && (row.suspended_at || row.suspension_reason)) ||
      (!hasRecords && !row.suspended_at);
    if (!needsUpdate) continue;
    await entities.SubdomainOwnership.update(row.id, payload);
    if (hasRecords) stats.activated++;
    else stats.suspended++;
    Object.assign(row, payload);
  }

  if (auditActor) {
    await entities.AuditLog.create({
      actor_email: auditActor,
      actor_role: 'admin',
      action: 'subdomain_ownership_reconciled',
      entity_type: 'SubdomainOwnership',
      description: `Reconciled ownership integrity: ${stats.activated} activated, ${stats.suspended} suspended, ${stats.duplicates_removed} duplicates removed, ${stats.stray_children_removed} stray child ownerships removed, ${stats.normalized_dns_records} DNS statuses normalized`,
      new_value: JSON.stringify(stats),
    });
  }

  return { stats, ownerships: ownerships.filter(row => !row._removed), liveRecords };
}
