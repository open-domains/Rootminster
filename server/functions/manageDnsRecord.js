import { createPlatformClientFromRequest } from '../lib/platform-client.js';
const CF_BASE = 'https://api.cloudflare.com/client/v4';
const CF_TOKEN = process.env['CLOUDFLARE_API_TOKEN'];
const PROXYABLE = new Set(['A', 'AAAA', 'CNAME']);
const TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR']);
async function cfFetch(method, path, body) {
    const res = await fetch(`${CF_BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ...data, _httpStatus: res.status };
}
function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\.+$/, '');
}
function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}
function hostnameWithin(hostname, base) {
    return hostname === base || hostname.endsWith(`.${base}`);
}
function validateHostname(name) {
    if (!name || name.length > 253)
        return 'Invalid hostname';
    const labels = name.split('.');
    if (labels.some(label => !label || label.length > 63))
        return 'Hostname contains an invalid label';
    for (const label of labels) {
        if (label === '*')
            continue;
        if (!/^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/i.test(label)) {
            return `Invalid hostname label: ${label}`;
        }
    }
    return null;
}
function isPrivateIpv4(ip) {
    return /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(ip) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
        /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);
}
function isPrivateIpv6(ip) {
    const v = ip.toLowerCase();
    return v === '::1' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd');
}
function validateValue(type, raw) {
    const value = String(raw || '').trim();
    if (!value)
        return 'Record content is required';
    if (type === 'A') {
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value) || value.split('.').map(Number).some(n => n > 255))
            return 'Invalid IPv4 address';
        if (isPrivateIpv4(value))
            return 'Private, loopback, carrier-grade NAT, and link-local IPv4 addresses are not permitted';
    }
    if (type === 'AAAA') {
        if (!/^[0-9a-fA-F:]+$/.test(value) || !value.includes(':'))
            return 'Invalid IPv6 address';
        if (isPrivateIpv6(value))
            return 'Private, loopback, and link-local IPv6 addresses are not permitted';
    }
    if (type === 'CNAME') {
        const target = value.replace(/\.$/, '');
        if (target === '@')
            return null;
        if (target.includes(' ') || !/^(\*\.)?[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+$/.test(target))
            return 'Invalid CNAME target';
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(target))
            return 'CNAME target must be a hostname, not an IP address';
    }
    if (type === 'MX') {
        const match = value.match(/^(?:(\d{1,3})\s+)?(.+)$/);
        if (!match || !match[2] || !match[2].includes('.'))
            return 'MX requires a mail hostname, optionally prefixed by priority';
    }
    if (type === 'NS' && (!/^[a-zA-Z0-9._-]+\.?$/.test(value) || !value.includes('.')))
        return 'Invalid NS hostname';
    if (type === 'TXT' && value.length > 2048)
        return 'TXT value is too long';
    return null;
}
function zoneRelativeName(hostname, zoneName) {
    if (hostname === zoneName)
        return '@';
    const suffix = `.${zoneName}`;
    if (!hostname.endsWith(suffix))
        throw new Error(`Hostname ${hostname} is outside Cloudflare zone ${zoneName}`);
    return hostname.slice(0, -suffix.length);
}
async function findZone(platform, hostname) {
    const domains = await platform.asServiceRole.entities.Domain.list();
    const matches = domains
        .filter((d) => d.zone_id && hostnameWithin(hostname, normalizeName(d.name)))
        .sort((a, b) => normalizeName(b.name).length - normalizeName(a.name).length);
    if (!matches.length)
        throw new Error('Could not determine the Cloudflare zone for this hostname');
    return matches[0];
}
async function getOwnedNamespaces(platform, user) {
    const [ownerships, ownedRecords] = await Promise.all([
        platform.asServiceRole.entities.SubdomainOwnership.filter({ owner_id: user.id }),
        platform.asServiceRole.entities.DnsRecord.filter({ owner_id: user.id, managed: true }),
    ]);
    const names = new Set();
    for (const ownership of ownerships) {
        const full = normalizeName(ownership.full_name);
        if (full)
            names.add(full);
    }
    // Migrated/legacy ownership may not have a SubdomainOwnership row yet. In that case use
    // the shallowest owned DNS names as conservative namespace anchors.
    const recordNames = Array.from(new Set(ownedRecords.map((r) => normalizeName(r.name)).filter(Boolean)));
    for (const name of recordNames) {
        const hasOwnedParent = recordNames.some(other => other !== name && hostnameWithin(name, other));
        if (!hasOwnedParent)
            names.add(name);
    }
    return Array.from(names).sort((a, b) => b.length - a.length);
}
async function assertUserCanManageName(platform, user, hostname, baseName) {
    const requestedBase = baseName ? normalizeName(baseName) : null;
    // Even admins/staff must respect an explicitly supplied editor boundary. This
    // prevents a crafted request from escaping the domain currently open in UI.
    if (requestedBase && !hostnameWithin(hostname, requestedBase)) {
        throw new Error('The DNS name must stay inside the domain you are managing');
    }
    if (user.role === 'admin' || user.role === 'staff')
        return requestedBase;
    const namespaces = await getOwnedNamespaces(platform, user);
    if (requestedBase) {
        const ownsBase = namespaces.some(ns => requestedBase === ns || hostnameWithin(requestedBase, ns));
        if (!ownsBase)
            throw new Error('You do not own this domain namespace');
        return requestedBase;
    }
    const match = namespaces.find(ns => hostnameWithin(hostname, ns));
    if (!match)
        throw new Error('You do not own this domain namespace');
    return match;
}
async function upsertSubdomainOwnership(platform, owner, fullName, zone, status = 'active') {
    const full = normalizeName(fullName);
    const zoneName = normalizeName(zone?.name || zone?.zone_name || '');
    if (!full || !owner?.id || !owner?.email)
        return null;
    const existing = await platform.asServiceRole.entities.SubdomainOwnership.filter({ owner_id: owner.id, full_name: full });
    const payload = {
        full_name: full,
        subdomain: zoneName && full.endsWith(`.${zoneName}`) ? full.slice(0, -(zoneName.length + 1)) : full,
        root_domain: zoneName,
        zone_id: zone?.zone_id || zone?.id || '',
        owner_email: owner.email,
        owner_id: owner.id,
        status,
    };
    if (status === 'active') {
        payload.suspended_at = null;
        payload.suspension_reason = '';
        payload.last_record_added_at = new Date().toISOString();
    }
    else {
        payload.suspended_at = new Date().toISOString();
        payload.suspension_reason = 'No DNS records remain';
    }
    if (existing.length) {
        await platform.asServiceRole.entities.SubdomainOwnership.update(existing[0].id, payload);
        return { ...existing[0], ...payload };
    }
    return platform.asServiceRole.entities.SubdomainOwnership.create(payload);
}
function recordOwnedBy(record, user) {
    if (user.role === 'admin' || user.role === 'staff')
        return true;
    return record.owner_id === user.id || normalizeEmail(record.owner_email) === normalizeEmail(user.email);
}
async function assertNotBlocked(platform, type, content) {
    const value = String(content || '').trim().toLowerCase();
    const blocklist = await platform.asServiceRole.entities.BlocklistEntry.list();
    const blocked = blocklist.find((entry) => {
        const typeMatch = !entry.record_type || entry.record_type === 'ANY' || entry.record_type === type;
        if (!typeMatch)
            return false;
        if (entry.is_regex) {
            try {
                return new RegExp(entry.value, 'i').test(value);
            }
            catch {
                return false;
            }
        }
        return String(entry.value || '').toLowerCase() === value;
    });
    if (blocked)
        throw new Error(`This record value is not permitted${blocked.reason ? `: ${blocked.reason}` : ''}`);
}
async function assertNoConflict(platform, candidate, excludeId) {
    const existing = await platform.asServiceRole.entities.DnsRecord.filter({ name: candidate.name, status: 'active' });
    const others = existing.filter((r) => r.id !== excludeId);
    if (candidate.record_type === 'CNAME') {
        if (others.some((r) => r.record_type === 'CNAME'))
            throw new Error('Only one CNAME is allowed at the same hostname');
        if (!candidate.cname_flatten && others.length)
            throw new Error('CNAME cannot coexist with another record at the same hostname unless CNAME flattening is enabled');
    }
    else {
        if (others.some((r) => r.record_type === 'CNAME' && !r.cname_flatten))
            throw new Error('A non-flattened CNAME already exists at this hostname');
    }
    const duplicate = others.find((r) => r.record_type === candidate.record_type && String(r.content || '').trim().toLowerCase() === String(candidate.content || '').trim().toLowerCase());
    if (duplicate)
        throw new Error(`An identical ${candidate.record_type} record already exists`);
}
function cloudflarePayload(record, zone) {
    let content = String(record.content || '').trim();
    let priority = record.priority;
    if (record.record_type === 'MX') {
        const match = content.match(/^(\d{1,3})\s+(.+)$/);
        if (match) {
            priority = Number(match[1]);
            content = match[2].trim();
        }
        else if (priority === undefined || priority === null) {
            priority = 10;
        }
    }
    if (['CNAME', 'NS', 'MX'].includes(record.record_type))
        content = content.replace(/\.$/, '');
    if (record.record_type === 'CNAME' && content === '@')
        content = zone.name;
    const payload = {
        type: record.record_type,
        name: record.name,
        content,
        ttl: Number(record.ttl || 3600),
        proxied: PROXYABLE.has(record.record_type) ? !!record.proxied : false,
    };
    if (record.record_type === 'MX')
        payload.priority = priority;
    if (record.record_type === 'SRV' && record.data)
        payload.data = record.data;
    const canSetFlattenPerRecord = record.record_type === 'CNAME' && !record.proxied && record.name !== zone.name;
    if (canSetFlattenPerRecord && (record.cname_flatten === true || record._includeFlattenSetting)) {
        payload.settings = { flatten_cname: !!record.cname_flatten };
    }
    return payload;
}
function validateFlatten(record) {
    return record.cname_flatten && record.record_type !== 'CNAME'
        ? 'CNAME flattening can only be enabled on CNAME records'
        : null;
}
function cnameFlattenMode(record, zone) {
    if (!record.cname_flatten)
        return 'disabled';
    if (record.name === zone.name)
        return 'automatic_at_apex';
    if (record.proxied)
        return 'automatic_when_proxied';
    return 'per_record';
}
export default async function (req) {
    try {
        if (req.method !== 'POST')
            return Response.json({ error: 'Method not allowed' }, { status: 405 });
        const platform = createPlatformClientFromRequest(req);
        const body = await req.json().catch(() => ({}));
        let user = await platform.auth.me().catch(() => null);
        // Public API calls authenticate with OpenDomains ApiToken records rather than
        // Browser sessions. The API passes the already-resolved token ID; we re-check
        // it here so direct callers cannot impersonate an owner by supplying email/ID.
        if (!user && body.api_token_id) {
            const tokens = await platform.asServiceRole.entities.ApiToken.filter({ id: body.api_token_id, revoked: false });
            const token = tokens[0];
            const tokenEmail = token?.user_email || token?.owner_email || token?.created_by;
            if (tokenEmail) {
                const users = await platform.asServiceRole.entities.User.filter({ email: tokenEmail });
                user = users[0] || null;
            }
        }
        if (!user)
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const action = String(body.action || '').toLowerCase();
        if (!['create', 'update', 'delete'].includes(action))
            return Response.json({ error: 'action must be create, update, or delete' }, { status: 400 });
        if (action === 'delete') {
            if (!body.record_id)
                return Response.json({ error: 'record_id is required' }, { status: 400 });
            const rows = await platform.asServiceRole.entities.DnsRecord.filter({ id: body.record_id });
            if (!rows.length)
                return Response.json({ error: 'DNS record not found' }, { status: 404 });
            const record = rows[0];
            if (!recordOwnedBy(record, user))
                return Response.json({ error: 'Forbidden: you do not own this DNS record' }, { status: 403 });
            if (!record.cloudflare_record_id || !record.zone_id)
                return Response.json({ error: 'Record is missing Cloudflare linkage' }, { status: 422 });
            const managedBase = normalizeName(body.base_name || record.name);
            if (!hostnameWithin(normalizeName(record.name), managedBase)) {
                return Response.json({ error: 'The DNS record is outside the domain you are managing' }, { status: 400 });
            }
            const zone = { name: record.zone_name, zone_id: record.zone_id };
            const recordOwner = { id: record.owner_id, email: record.owner_email };
            // Persist ownership before removing the last DNS row so an empty subdomain can be suspended cleanly.
            await upsertSubdomainOwnership(platform, recordOwner, managedBase, zone, 'active');
            const cf = await cfFetch('DELETE', `/zones/${record.zone_id}/dns_records/${record.cloudflare_record_id}`);
            // Treat an already-missing Cloudflare record as deleted; the DB must not retain a ghost row.
            if (!cf.success && cf._httpStatus !== 404)
                return Response.json({ error: `Cloudflare delete failed: ${cf.errors?.[0]?.message || 'unknown error'}` }, { status: 502 });
            await platform.asServiceRole.entities.DnsRecord.delete(record.id);
            const ownedRecords = await platform.asServiceRole.entities.DnsRecord.filter({ owner_id: record.owner_id, managed: true });
            const remaining = ownedRecords.filter((r) => hostnameWithin(normalizeName(r.name), managedBase));
            let subdomainSuspended = false;
            if (remaining.length === 0) {
                await upsertSubdomainOwnership(platform, recordOwner, managedBase, zone, 'suspended');
                subdomainSuspended = true;
                await platform.asServiceRole.entities.AuditLog.create({
                    actor_email: user.email, actor_role: user.role || 'user', action: 'subdomain_suspended_empty',
                    entity_type: 'SubdomainOwnership',
                    description: `Suspended ${managedBase} because its final DNS record was deleted`
                });
            }
            await platform.asServiceRole.entities.AuditLog.create({
                actor_email: user.email, actor_role: user.role || 'user', action: 'dns_record_deleted',
                entity_type: 'DnsRecord', entity_id: record.id,
                description: `Deleted ${record.name} (${record.record_type}) from Cloudflare and database`, old_value: JSON.stringify(record)
            });
            return Response.json({ success: true, action: 'delete', subdomain_suspended: subdomainSuspended, deleted: { id: record.id, name: record.name, record_type: record.record_type, content: record.content } });
        }
        if (action === 'update') {
            if (!body.record_id)
                return Response.json({ error: 'record_id is required' }, { status: 400 });
            const rows = await platform.asServiceRole.entities.DnsRecord.filter({ id: body.record_id });
            if (!rows.length)
                return Response.json({ error: 'DNS record not found' }, { status: 404 });
            const old = rows[0];
            if (!recordOwnedBy(old, user))
                return Response.json({ error: 'Forbidden: you do not own this DNS record' }, { status: 403 });
            const candidate = {
                ...old,
                name: body.name !== undefined ? normalizeName(body.name) : normalizeName(old.name),
                record_type: body.record_type !== undefined ? String(body.record_type).toUpperCase() : old.record_type,
                content: body.content !== undefined ? String(body.content).trim() : old.content,
                ttl: body.ttl !== undefined ? Number(body.ttl) : old.ttl,
                proxied: body.proxied !== undefined ? !!body.proxied : old.proxied,
                priority: body.priority !== undefined ? Number(body.priority) : old.priority,
                cname_flatten: body.cname_flatten !== undefined ? !!body.cname_flatten : !!old.cname_flatten,
                _includeFlattenSetting: body.cname_flatten !== undefined,
            };
            const nameError = validateHostname(candidate.name);
            if (nameError)
                return Response.json({ error: nameError }, { status: 400 });
            if (!TYPES.has(candidate.record_type))
                return Response.json({ error: 'Unsupported record type' }, { status: 400 });
            const valueError = validateValue(candidate.record_type, candidate.content);
            if (valueError)
                return Response.json({ error: valueError }, { status: 400 });
            if (!PROXYABLE.has(candidate.record_type))
                candidate.proxied = false;
            if (candidate.record_type !== 'CNAME')
                candidate.cname_flatten = false;
            const flattenError = validateFlatten(candidate);
            if (flattenError)
                return Response.json({ error: flattenError }, { status: 400 });
            await assertNotBlocked(platform, candidate.record_type, candidate.content);
            await assertUserCanManageName(platform, user, candidate.name, body.base_name);
            await assertNoConflict(platform, candidate, old.id);
            const zone = await findZone(platform, candidate.name);
            if (normalizeName(zone.name) !== normalizeName(old.zone_name) || zone.zone_id !== old.zone_id) {
                return Response.json({ error: 'Moving a DNS record between Cloudflare zones is not supported' }, { status: 400 });
            }
            if (candidate.record_type === 'NS' && !user.ns_unlocked && user.role !== 'admin' && user.role !== 'staff') {
                return Response.json({ error: 'NS records are not unlocked for this account' }, { status: 403 });
            }
            if (!old.cloudflare_record_id || !old.zone_id)
                return Response.json({ error: 'Record is missing Cloudflare linkage' }, { status: 422 });
            const cf = await cfFetch('PUT', `/zones/${old.zone_id}/dns_records/${old.cloudflare_record_id}`, cloudflarePayload(candidate, zone));
            if (!cf.success)
                return Response.json({ error: `Cloudflare update failed: ${cf.errors?.[0]?.message || 'unknown error'}` }, { status: 502 });
            const cfRecord = cf.result || {};
            const updates = {
                name: normalizeName(cfRecord.name || candidate.name),
                subdomain: zoneRelativeName(normalizeName(cfRecord.name || candidate.name), normalizeName(zone.name)),
                record_type: candidate.record_type,
                content: candidate.content,
                ttl: candidate.ttl,
                proxied: candidate.proxied,
                cname_flatten: candidate.cname_flatten,
                priority: candidate.record_type === 'MX' ? (cfRecord.priority ?? candidate.priority ?? 10) : candidate.priority,
                zone_id: zone.zone_id,
                zone_name: normalizeName(zone.name),
                cloudflare_record_id: cfRecord.id || old.cloudflare_record_id,
                last_synced: new Date().toISOString(),
                dns_verified: null,
                dns_mismatch_reason: null,
            };
            await platform.asServiceRole.entities.DnsRecord.update(old.id, updates);
            await platform.asServiceRole.entities.AuditLog.create({
                actor_email: user.email, actor_role: user.role || 'user', action: 'dns_record_updated',
                entity_type: 'DnsRecord', entity_id: old.id,
                description: `Updated ${old.name} (${old.record_type})`,
                old_value: JSON.stringify({ name: old.name, record_type: old.record_type, content: old.content, ttl: old.ttl, proxied: old.proxied }),
                new_value: JSON.stringify(updates)
            });
            return Response.json({ success: true, action: 'update', cname_flatten_mode: cnameFlattenMode(candidate, zone), record: { id: old.id, ...updates } });
        }
        const name = normalizeName(body.name);
        const recordType = String(body.record_type || '').toUpperCase();
        const content = String(body.content || '').trim();
        const nameError = validateHostname(name);
        if (nameError)
            return Response.json({ error: nameError }, { status: 400 });
        if (!TYPES.has(recordType))
            return Response.json({ error: 'Unsupported record type' }, { status: 400 });
        const valueError = validateValue(recordType, content);
        if (valueError)
            return Response.json({ error: valueError }, { status: 400 });
        await assertNotBlocked(platform, recordType, content);
        const managedBase = await assertUserCanManageName(platform, user, name, body.base_name);
        let owner = user;
        if ((user.role === 'admin' || user.role === 'staff') && body.owner_email) {
            const ownerRows = await platform.asServiceRole.entities.User.filter({ email: body.owner_email });
            if (!ownerRows.length)
                return Response.json({ error: `No user found for ${body.owner_email}` }, { status: 404 });
            owner = ownerRows[0];
        }
        if (recordType === 'NS' && !owner.ns_unlocked && user.role !== 'admin' && user.role !== 'staff') {
            return Response.json({ error: 'NS records are not unlocked for this account' }, { status: 403 });
        }
        const zone = await findZone(platform, name);
        const candidate = {
            name, record_type: recordType, content,
            ttl: Number(body.ttl || 3600),
            proxied: PROXYABLE.has(recordType) ? !!body.proxied : false,
            cname_flatten: !!body.cname_flatten,
            _includeFlattenSetting: body.cname_flatten !== undefined,
            priority: body.priority !== undefined ? Number(body.priority) : undefined,
        };
        const flattenError = validateFlatten(candidate);
        if (flattenError)
            return Response.json({ error: flattenError }, { status: 400 });
        await assertNoConflict(platform, candidate);
        const cf = await cfFetch('POST', `/zones/${zone.zone_id}/dns_records`, cloudflarePayload(candidate, zone));
        if (!cf.success)
            return Response.json({ error: `Cloudflare create failed: ${cf.errors?.[0]?.message || 'unknown error'}` }, { status: 502 });
        const cfRecord = cf.result || {};
        const finalName = normalizeName(cfRecord.name || name);
        const created = await platform.asServiceRole.entities.DnsRecord.create({
            zone_id: zone.zone_id,
            zone_name: normalizeName(zone.name),
            cloudflare_record_id: cfRecord.id,
            record_type: recordType,
            name: finalName,
            subdomain: zoneRelativeName(finalName, normalizeName(zone.name)),
            content,
            proxied: candidate.proxied,
            cname_flatten: candidate.cname_flatten,
            ttl: candidate.ttl,
            priority: recordType === 'MX' ? (cfRecord.priority ?? candidate.priority ?? 10) : candidate.priority,
            managed: true,
            owner_email: owner.email,
            owner_id: owner.id,
            status: 'active',
            last_synced: new Date().toISOString(),
            dns_verified: null,
        });
        const ownershipBase = normalizeName(body.base_name || managedBase || finalName);
        await upsertSubdomainOwnership(platform, owner, ownershipBase, zone, 'active');
        await platform.asServiceRole.entities.AuditLog.create({
            actor_email: user.email, actor_role: user.role || 'user', action: 'dns_record_created',
            entity_type: 'DnsRecord', entity_id: created.id,
            description: `Created ${finalName} (${recordType})`, new_value: JSON.stringify(created)
        });
        return Response.json({ success: true, action: 'create', cname_flatten_mode: cnameFlattenMode(candidate, zone), record: created });
    }
    catch (error) {
        const message = error?.message || 'Unknown error';
        const forbidden = /do not own|not unlocked|not permitted/i.test(message);
        return Response.json({ error: message }, { status: forbidden ? 403 : 400 });
    }
}
