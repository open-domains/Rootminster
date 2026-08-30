import { createPlatformClientFromRequest } from '../lib/platform-client.js';
const GRACE_DAYS = 7;
function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\.+$/, '');
}
function hostnameWithin(hostname, base) {
    return hostname === base || hostname.endsWith(`.${base}`);
}
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me();
        if (!user || user.role !== 'admin')
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        const now = Date.now();
        const cutoff = now - GRACE_DAYS * 24 * 60 * 60 * 1000;
        const [ownerships, allRecords, approvedRequests, domains] = await Promise.all([
            platform.asServiceRole.entities.SubdomainOwnership.list(),
            platform.asServiceRole.entities.DnsRecord.list(),
            platform.asServiceRole.entities.SubdomainRequest.filter({ status: 'approved' }),
            platform.asServiceRole.entities.Domain.list(),
        ]);
        const domainByName = new Map(domains.map((d) => [normalizeName(d.name), d]));
        // Claim legacy DNS rows only when an approved request provides a strong record link.
        // Cloudflare sync may have recreated a row with a new database ID, so the Cloudflare ID
        // is also accepted. Unrelated unmanaged zone records remain untouched.
        let dnsRecordsMigrated = 0;
        for (const record of allRecords) {
            if (record.owner_id && record.owner_email && record.managed)
                continue;
            const approved = approvedRequests.find((request) => request.requester_id && request.requester_email && (request.dns_record_id === record.id ||
                (request.cloudflare_record_id && request.cloudflare_record_id === record.cloudflare_record_id)));
            if (!approved)
                continue;
            const updated = await platform.asServiceRole.entities.DnsRecord.update(record.id, {
                owner_id: approved.requester_id,
                owner_email: approved.requester_email,
                managed: true,
            });
            Object.assign(record, updated);
            dnsRecordsMigrated++;
        }
        const legacySuspended = allRecords.filter((r) => r.status === 'suspended' && r.managed);
        const records = allRecords.filter((r) => r.status === 'active' && r.managed);
        let backfilled = 0;
        let suspended = 0;
        let reactivated = 0;
        let deleted = 0;
        let legacyRecordsDeleted = 0;
        const inferBaseName = (record) => {
            const name = normalizeName(record.name);
            const zone = normalizeName(record.zone_name);
            if (!name || !zone || !name.endsWith(`.${zone}`))
                return null;
            const relative = name.slice(0, -(zone.length + 1));
            const labels = relative.split('.').filter(Boolean);
            if (!labels.length)
                return null;
            return `${labels[labels.length - 1]}.${zone}`;
        };
        // Preserve ownership for legacy/migrated domains before hard-deleting old suspended DNS rows.
        // Prefer approved request boundaries; otherwise conservatively infer the root managed label.
        for (const record of allRecords) {
            if (!record.owner_id || !record.owner_email)
                continue;
            const recordName = normalizeName(record.name);
            const approved = approvedRequests
                .filter((r) => r.requester_id === record.owner_id)
                .map((r) => ({ ...r, full: normalizeName(r.full_name || `${r.subdomain}.${r.root_domain}`) }))
                .filter((r) => r.full && hostnameWithin(recordName, r.full))
                .sort((a, b) => b.full.length - a.full.length)[0];
            const fullName = approved?.full || inferBaseName(record);
            if (!fullName)
                continue;
            const exists = ownerships.find((o) => o.owner_id === record.owner_id && normalizeName(o.full_name) === fullName);
            if (exists)
                continue;
            const zoneName = normalizeName(record.zone_name);
            const created = await platform.asServiceRole.entities.SubdomainOwnership.create({
                full_name: fullName,
                subdomain: fullName.endsWith(`.${zoneName}`) ? fullName.slice(0, -(zoneName.length + 1)) : fullName,
                root_domain: zoneName,
                zone_id: record.zone_id || '',
                owner_email: record.owner_email,
                owner_id: record.owner_id,
                status: 'active',
            });
            ownerships.push(created);
            backfilled++;
        }
        // Old record-level suspension is retired. These rows are no longer valid state and are
        // hard-deleted from the database. Cloudflare records were already removed/suspended by
        // the legacy flow, so this migration deliberately does not issue new Cloudflare deletes.
        for (const record of legacySuspended) {
            await platform.asServiceRole.entities.DnsRecord.delete(record.id);
            legacyRecordsDeleted++;
        }
        // Backfill durable ownership for existing approved subdomains so cleanup no longer depends on DNS rows.
        for (const request of approvedRequests) {
            const fullName = normalizeName(request.full_name || `${request.subdomain}.${request.root_domain}`);
            if (!fullName || !request.requester_id || !request.requester_email)
                continue;
            const existing = ownerships.find((o) => o.owner_id === request.requester_id && normalizeName(o.full_name) === fullName);
            if (existing)
                continue;
            const domain = domainByName.get(normalizeName(request.root_domain));
            const hasRecords = records.some((r) => r.owner_id === request.requester_id && hostnameWithin(normalizeName(r.name), fullName));
            const created = await platform.asServiceRole.entities.SubdomainOwnership.create({
                full_name: fullName,
                subdomain: request.subdomain,
                root_domain: request.root_domain,
                zone_id: domain?.zone_id || '',
                owner_email: request.requester_email,
                owner_id: request.requester_id,
                status: hasRecords ? 'active' : 'suspended',
                suspended_at: hasRecords ? null : new Date().toISOString(),
                suspension_reason: hasRecords ? '' : 'No DNS records remain',
            });
            ownerships.push(created);
            backfilled++;
            if (!hasRecords)
                suspended++;
        }
        for (const ownership of ownerships) {
            const fullName = normalizeName(ownership.full_name);
            const hasRecords = records.some((r) => r.owner_id === ownership.owner_id && hostnameWithin(normalizeName(r.name), fullName));
            if (hasRecords) {
                if (ownership.status === 'suspended') {
                    await platform.asServiceRole.entities.SubdomainOwnership.update(ownership.id, {
                        status: 'active', suspended_at: null, suspension_reason: '', last_record_added_at: new Date().toISOString()
                    });
                    reactivated++;
                }
                continue;
            }
            if (ownership.status !== 'suspended') {
                await platform.asServiceRole.entities.SubdomainOwnership.update(ownership.id, {
                    status: 'suspended', suspended_at: new Date().toISOString(), suspension_reason: 'No DNS records remain'
                });
                await platform.asServiceRole.entities.AuditLog.create({
                    actor_email: 'system', actor_role: 'admin', action: 'subdomain_suspended_empty',
                    entity_type: 'SubdomainOwnership', entity_id: ownership.id,
                    description: `Suspended ${fullName} because it has no DNS records`
                });
                suspended++;
                continue;
            }
            const suspendedAt = ownership.suspended_at ? new Date(ownership.suspended_at).getTime() : now;
            if (suspendedAt > cutoff)
                continue;
            // Remove the ownership row from the user's account. Historical request/audit data is intentionally retained.
            await platform.asServiceRole.entities.SubdomainOwnership.delete(ownership.id);
            await platform.asServiceRole.entities.AuditLog.create({
                actor_email: 'system', actor_role: 'admin', action: 'subdomain_removed_inactive',
                entity_type: 'SubdomainOwnership', entity_id: ownership.id,
                description: `Removed ${fullName} from ${ownership.owner_email} after ${GRACE_DAYS} days suspended with no DNS records`
            });
            deleted++;
        }
        return Response.json({ success: true, grace_days: GRACE_DAYS, checked: ownerships.length, dns_records_migrated: dnsRecordsMigrated, backfilled, suspended, reactivated, deleted, legacy_records_deleted: legacyRecordsDeleted });
    }
    catch (error) {
        console.error('cleanupSuspendedRecords failed', error);
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        }, { status: 500 });
    }
}
