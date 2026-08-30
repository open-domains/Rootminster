import { createPlatformClientFromRequest } from '../lib/platform-client.js';
const INDEX_URL = 'https://raw.githubusercontent.com/open-domains/raw/refs/heads/main/scripts/raw/index.json';
async function getAllDomainRecords() {
    const res = await fetch(INDEX_URL, { headers: { 'User-Agent': 'OpenDomains-Platform' } });
    if (!res.ok)
        throw new Error('Failed to fetch domain index');
    return res.json();
}
function extractRecords(record, proxied) {
    const results = [];
    if (!record)
        return results;
    if (record.CNAME)
        results.push({ type: 'CNAME', value: record.CNAME, proxied: proxied || false });
    if (record.A) {
        const a = Array.isArray(record.A) ? record.A : [record.A];
        for (const v of a)
            results.push({ type: 'A', value: v, proxied: proxied || false });
    }
    if (record.AAAA) {
        const a = Array.isArray(record.AAAA) ? record.AAAA : [record.AAAA];
        for (const v of a)
            results.push({ type: 'AAAA', value: v, proxied: proxied || false });
    }
    if (record.TXT) {
        const a = Array.isArray(record.TXT) ? record.TXT : [record.TXT];
        for (const v of a)
            results.push({ type: 'TXT', value: v, proxied: false });
    }
    if (record.MX) {
        const a = Array.isArray(record.MX) ? record.MX : [record.MX];
        for (const v of a)
            results.push({ type: 'MX', value: v, proxied: false });
    }
    if (record.NS) {
        const a = Array.isArray(record.NS) ? record.NS : [record.NS];
        for (const v of a)
            results.push({ type: 'NS', value: v, proxied: false });
    }
    return results;
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const actor = await platform.auth.me();
    if (!actor)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'admin' && actor.role !== 'staff')
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { github_email, target_user_id } = await req.json();
    if (!github_email)
        return Response.json({ error: 'github_email is required' }, { status: 400 });
    if (!target_user_id)
        return Response.json({ error: 'target_user_id is required' }, { status: 400 });
    // Fetch the target user
    const targetUsers = await platform.asServiceRole.entities.User.filter({ id: target_user_id });
    if (targetUsers.length === 0)
        return Response.json({ error: 'Target user not found' }, { status: 404 });
    const targetUser = targetUsers[0];
    const normalizedEmail = github_email.toLowerCase().trim();
    // Fetch index and find matching records
    const allRecords = await getAllDomainRecords();
    const matched = allRecords
        .filter(data => {
        if (!data.subdomain || data.subdomain.startsWith('*.'))
            return false;
        return data.owner?.email?.toLowerCase().trim() === normalizedEmail;
    })
        .map(data => ({ data }));
    if (matched.length === 0) {
        return Response.json({ found: 0, imported: 0, skipped: 0, details: [], message: 'No domains found for this email.' });
    }
    // Check for NS records upfront — grant Legacy Donor before importing
    const hasNS = matched.some(({ data }) => data.record?.NS);
    if (hasNS && !targetUser.ns_unlocked) {
        await platform.asServiceRole.entities.User.update(targetUser.id, { legacy_donor: true, ns_unlocked: true });
    }
    const domains = await platform.asServiceRole.entities.Domain.filter({ status: 'active' });
    const domainMap = {};
    for (const d of domains)
        domainMap[d.name] = d;
    let imported = 0;
    let skipped = 0;
    const details = [];
    for (const { data } of matched) {
        const subdomain = data.subdomain;
        const rootDomain = data.domain;
        const fullName = `${subdomain}.${rootDomain}`;
        const domain = domainMap[rootDomain];
        if (!domain) {
            details.push({ full_name: fullName, status: 'skipped', reason: `Domain ${rootDomain} not on platform` });
            skipped++;
            continue;
        }
        const records = extractRecords(data.record, data.proxied);
        if (records.length === 0) {
            details.push({ full_name: fullName, status: 'skipped', reason: 'No supported record types' });
            skipped++;
            continue;
        }
        for (const rec of records) {
            const existing = await platform.asServiceRole.entities.DnsRecord.filter({
                name: fullName, record_type: rec.type, zone_id: domain.zone_id
            });
            // Match by exact content first, fall back to first result
            const exactMatch = existing.find(r => r.content === rec.value);
            const dnsRecord = exactMatch || (existing.length > 0 ? existing[0] : null);
            if (dnsRecord) {
                if (dnsRecord.managed && dnsRecord.owner_email) {
                    details.push({ full_name: fullName, type: rec.type, status: 'skipped', reason: 'Already managed' });
                    skipped++;
                    continue;
                }
                await platform.asServiceRole.entities.DnsRecord.update(dnsRecord.id, {
                    managed: true, owner_email: targetUser.email, owner_id: targetUser.id, status: 'active'
                });
            }
            else {
                await platform.asServiceRole.entities.DnsRecord.create({
                    zone_id: domain.zone_id, zone_name: rootDomain, record_type: rec.type,
                    name: fullName, subdomain, content: rec.value, proxied: rec.proxied,
                    ttl: 3600, managed: true, owner_email: targetUser.email, owner_id: targetUser.id,
                    status: 'active', last_synced: new Date().toISOString()
                });
            }
            details.push({ full_name: fullName, type: rec.type, status: 'imported' });
            imported++;
        }
    }
    // Audit log
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: actor.email, actor_role: actor.role,
        action: 'admin_migration', entity_type: 'DnsRecord',
        description: `Admin migration: ${imported} records from GitHub email "${normalizedEmail}" assigned to ${targetUser.email}. Legacy Donor: ${hasNS ? 'granted' : 'no change'}`
    });
    return Response.json({ found: matched.length, imported, skipped, details, legacy_granted: hasNS && !targetUser.ns_unlocked });
}
