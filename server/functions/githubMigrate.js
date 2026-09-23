const escapeEmail = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
import { config } from '../config.js';
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { syncOwnershipForNamespace } from '../lib/subdomain-ownership.js';
import { getModuleConfig } from '../module-settings.js';
async function getAllDomainRecords() {
    const github = await getModuleConfig('github_oauth');
    const res = await fetch(github.registry_url, { headers: { 'User-Agent': 'OpenDomains-Platform' } });
    if (!res.ok)
        throw new Error('Failed to fetch domain index');
    return res.json();
}
function extractRecords(record, proxied) {
    const results = [];
    if (!record)
        return results;
    if (record.CNAME) {
        results.push({ type: 'CNAME', value: record.CNAME, proxied: proxied || false });
    }
    if (record.A) {
        const addrs = Array.isArray(record.A) ? record.A : [record.A];
        for (const v of addrs)
            results.push({ type: 'A', value: v, proxied: proxied || false });
    }
    if (record.AAAA) {
        const addrs = Array.isArray(record.AAAA) ? record.AAAA : [record.AAAA];
        for (const v of addrs)
            results.push({ type: 'AAAA', value: v, proxied: proxied || false });
    }
    if (record.TXT) {
        const txts = Array.isArray(record.TXT) ? record.TXT : [record.TXT];
        for (const v of txts)
            results.push({ type: 'TXT', value: v, proxied: false });
    }
    if (record.MX) {
        const mxs = Array.isArray(record.MX) ? record.MX : [record.MX];
        for (const v of mxs)
            results.push({ type: 'MX', value: v, proxied: false });
    }
    if (record.NS) {
        const nss = Array.isArray(record.NS) ? record.NS : [record.NS];
        for (const v of nss)
            results.push({ type: 'NS', value: v, proxied: false });
    }
    return results;
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const normalizedEmail = user.email.toLowerCase().trim();
    const allRecords = await getAllDomainRecords();
    const matched = allRecords
        .filter(data => {
        if (!data.subdomain || data.subdomain.startsWith('*.'))
            return false;
        return data.owner?.email?.toLowerCase().trim() === normalizedEmail;
    })
        .map(data => ({ filename: `${data.subdomain}.${data.domain}.json`, data }));
    if (matched.length === 0) {
        return Response.json({ found: 0, imported: 0, skipped: 0, details: [], message: 'No domains found for your email in the old system.' });
    }
    const hasNSUpfront = matched.some(({ data }) => data.record?.NS);
    if (hasNSUpfront && !user.ns_unlocked) {
        await platform.asServiceRole.entities.User.update(user.id, { legacy_donor: true, ns_unlocked: true });
        await platform.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: '🎉 You\'ve been granted Legacy Donor status on Open Domains',
            body: `<p>Hi ${escapeEmail(user.full_name || user.email)},</p>
              <p>Because your migrated domains include <strong>NS (Nameserver) records</strong>, we have granted you Legacy Donor status and unlocked NS records on your account.</p>
              <div style="padding:16px;background:#f6f8fb;border:1px solid #dce1e7;border-radius:6px"><strong>What's unlocked</strong><ul><li>NS records when requesting subdomains</li><li>Legacy Donor badge</li></ul></div>
              <p><a href="${config.appUrl}/user-dashboard" style="display:inline-block;background:#206bc4;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Go to dashboard</a></p>`
        });
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
            details.push({ full_name: fullName, status: 'skipped', reason: `Domain ${rootDomain} not on this platform` });
            skipped++;
            continue;
        }
        const records = extractRecords(data.record, data.proxied);
        if (records.length === 0) {
            details.push({ full_name: fullName, status: 'skipped', reason: 'No supported record types found' });
            skipped++;
            continue;
        }
        let shouldSyncOwnership = false;
        for (const rec of records) {
            const existingRecs = await platform.asServiceRole.entities.DnsRecord.filter({
                name: fullName,
                record_type: rec.type,
                zone_id: domain.zone_id
            });
            const exactMatch = existingRecs.find(r => r.content === rec.value);
            const anyMatch = existingRecs.length > 0 ? existingRecs[0] : null;
            const dnsRecord = exactMatch || anyMatch;
            if (dnsRecord) {
                if (dnsRecord.managed && dnsRecord.owner_email) {
                    const sameOwner = dnsRecord.owner_id === user.id || dnsRecord.owner_email === user.email;
                    if (sameOwner)
                        shouldSyncOwnership = true;
                    details.push({ full_name: fullName, type: rec.type, status: 'skipped', reason: 'Already managed' });
                    skipped++;
                    continue;
                }
                await platform.asServiceRole.entities.DnsRecord.update(dnsRecord.id, {
                    managed: true,
                    owner_email: user.email,
                    owner_id: user.id,
                    status: 'active'
                });
                shouldSyncOwnership = true;
            }
            else {
                await platform.asServiceRole.entities.DnsRecord.create({
                    zone_id: domain.zone_id,
                    zone_name: rootDomain,
                    record_type: rec.type,
                    name: fullName,
                    subdomain,
                    content: rec.value,
                    proxied: rec.proxied,
                    ttl: 3600,
                    managed: true,
                    owner_email: user.email,
                    owner_id: user.id,
                    status: 'active',
                    last_synced: new Date().toISOString()
                });
                shouldSyncOwnership = true;
            }
            details.push({ full_name: fullName, type: rec.type, value: rec.value, status: 'imported' });
            imported++;
        }
        if (shouldSyncOwnership) {
            await syncOwnershipForNamespace(platform, {
                owner: user,
                fullName,
                zone: { name: rootDomain, zone_id: domain.zone_id },
            });
        }
    }
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'user',
        action: 'github_migration', entity_type: 'DnsRecord',
        description: `GitHub migration: ${imported} records claimed, ${skipped} skipped`
    });
    if (imported > 0) {
        const importedDomains = details.filter(d => d.status === 'imported');
        const domainListHtml = importedDomains.map(d => `<li><code>${escapeEmail(d.full_name)}</code> (${escapeEmail(d.type)})</li>`).join('');
        const domainListText = importedDomains.map(d => `• ${d.full_name} (${d.type})`).join('\n');
        await platform.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: `Your domains have been migrated — Open Domains`,
            body: `
        <p>Hi ${escapeEmail(user.full_name || user.email)},</p>
        <p>Your GitHub-registered domains have been successfully migrated and are now managed under your Open Domains account.</p>
        <p><strong>${imported} domain record${imported !== 1 ? 's' : ''} claimed:</strong></p>
        <ul>${domainListHtml}</ul>
        <p>You can view and manage them in your <a href="https://opendomains.uk/MySubdomains">dashboard</a>.</p>
        <p>— The Open Domains Team</p>
      `
        });
        const webhookSettings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_webhook_url' });
        const webhookUrl = webhookSettings?.[0]?.value;
        if (webhookUrl) {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [{
                            title: '🚀 GitHub Migration Completed',
                            color: 0x6366f1,
                            fields: [
                                { name: 'User', value: `${user.full_name || ''} (${user.email})`, inline: true },
                                { name: 'Records Claimed', value: `${imported}`, inline: true },
                                { name: 'Records Skipped', value: `${skipped}`, inline: true },
                                { name: 'Legacy Donor Granted', value: hasNSUpfront ? 'Yes ✦' : 'No', inline: true },
                                { name: 'Domains', value: domainListText || '—', inline: false }
                            ],
                            timestamp: new Date().toISOString()
                        }]
                })
            });
        }
    }
    return Response.json({ found: matched.length, imported, skipped, details });
}
