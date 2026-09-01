import { createPlatformClientFromRequest } from '../lib/platform-client.js';
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
    // Use the user's own account email — no manual email input required
    const normalizedEmail = user.email.toLowerCase().trim();
    // 1. Fetch the flat index from GitHub
    const allRecords = await getAllDomainRecords();
    // 2. Filter records belonging to this user's email (skip wildcards)
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
    // 3. Check upfront if any matched records have NS — grant Legacy Donor before importing
    const hasNSUpfront = matched.some(({ data }) => data.record?.NS);
    if (hasNSUpfront && !user.ns_unlocked) {
        await platform.asServiceRole.entities.User.update(user.id, { legacy_donor: true, ns_unlocked: true });
        await platform.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: '🎉 You\'ve been granted Legacy Donor status on Open Domains',
            body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:12px 12px 0 0;padding:36px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">💜</div>
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Legacy Donor Status Granted</h1>
          <p style="color:#c4b5fd;margin:8px 0 0;font-size:15px;">Thank you for your past support of Open Domains</p>
        </td></tr>
        <tr><td style="background:#1e293b;padding:36px 40px;">
          <p style="color:#e2e8f0;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${user.full_name || user.email},</p>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Because your migrated domains include <strong style="color:#a78bfa;">NS (Nameserver) records</strong>, we've automatically recognised you as a <strong style="color:#a78bfa;">Legacy Donor</strong> and unlocked full NS record privileges on your account.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:10px;margin-bottom:28px;">
            <tr><td style="padding:24px;">
              <p style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">What's unlocked</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;"><span style="color:#a78bfa;font-size:18px;margin-right:10px;">✦</span><span style="color:#e2e8f0;font-size:14px;">NS (Nameserver) record type when requesting subdomains</span></td></tr>
                <tr><td style="padding:6px 0;"><span style="color:#a78bfa;font-size:18px;margin-right:10px;">✦</span><span style="color:#e2e8f0;font-size:14px;">Legacy Donor badge on your account</span></td></tr>
                <tr><td style="padding:6px 0;"><span style="color:#a78bfa;font-size:18px;margin-right:10px;">✦</span><span style="color:#e2e8f0;font-size:14px;">Our heartfelt thanks for your continued support 💜</span></td></tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="https://open.domains/UserDashboard" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;">Go to my Dashboard →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#0f172a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #1e293b;">
          <p style="color:#475569;font-size:13px;margin:0;">Open Domains · <a href="https://open.domains" style="color:#6366f1;text-decoration:none;">open.domains</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
        });
    }
    // 4. Get available domains in our system
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
        for (const rec of records) {
            const existingRecs = await platform.asServiceRole.entities.DnsRecord.filter({
                name: fullName,
                record_type: rec.type,
                zone_id: domain.zone_id
            });
            // Find a record matching the exact content value
            const exactMatch = existingRecs.find(r => r.content === rec.value);
            const anyMatch = existingRecs.length > 0 ? existingRecs[0] : null;
            const dnsRecord = exactMatch || anyMatch;
            if (dnsRecord) {
                if (dnsRecord.managed && dnsRecord.owner_email) {
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
            }
            details.push({ full_name: fullName, type: rec.type, value: rec.value, status: 'imported' });
            imported++;
        }
    }
    // Audit log
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'user',
        action: 'github_migration', entity_type: 'DnsRecord',
        description: `GitHub migration: ${imported} records claimed, ${skipped} skipped`
    });
    if (imported > 0) {
        const importedDomains = details.filter(d => d.status === 'imported');
        const domainListHtml = importedDomains.map(d => `<li><code>${d.full_name}</code> (${d.type})</li>`).join('');
        const domainListText = importedDomains.map(d => `• ${d.full_name} (${d.type})`).join('\n');
        await platform.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: `Your domains have been migrated — Open Domains`,
            body: `
        <p>Hi ${user.full_name || user.email},</p>
        <p>Your GitHub-registered domains have been successfully migrated and are now managed under your Open Domains account.</p>
        <p><strong>${imported} domain record${imported !== 1 ? 's' : ''} claimed:</strong></p>
        <ul>${domainListHtml}</ul>
        <p>You can view and manage them in your <a href="https://opendomains.uk/MySubdomains">dashboard</a>.</p>
        <p>— The Open Domains Team</p>
      `
        });
        // Use the configured platform webhook rather than embedding a Discord credential in source.
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
