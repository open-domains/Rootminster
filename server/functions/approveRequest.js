import { createPlatformClientFromRequest } from '../lib/platform-client.js';
const CF_BASE = 'https://api.cloudflare.com/client/v4';
const CF_TOKEN = process.env['CLOUDFLARE_API_TOKEN'];
async function cfFetch(method, path, body) {
    const res = await fetch(`${CF_BASE}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
}
function approvalEmailHtml(subdomain, domain, recordType, recordValue) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;margin:0;padding:0}
  .container{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:28px;font-weight:700}
  .header p{color:rgba(255,255,255,.85);margin:8px 0 0}
  .body{padding:40px}
  .badge{display:inline-block;background:#d1fae5;color:#065f46;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:24px}
  .record-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0}
  .record-box code{font-family:monospace;background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:14px}
  .cta{display:block;width:fit-content;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;margin:24px auto 0;text-align:center}
  .footer{text-align:center;padding:24px;color:#94a3b8;font-size:13px;border-top:1px solid #f1f5f9}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>🎉 Request Approved</h1><p>Open Domains Platform</p></div>
    <div class="body">
      <span class="badge">✓ APPROVED</span>
      <h2 style="margin:0 0 8px;color:#1e293b">Your subdomain is live!</h2>
      <p style="color:#64748b">Great news! Your subdomain request has been approved and the DNS record is now active.</p>
      <div class="record-box">
        <p style="margin:0 0 8px;font-weight:600;color:#1e293b">Record Details</p>
        <p style="margin:4px 0;color:#475569">Subdomain: <code>${subdomain}.${domain}</code></p>
        <p style="margin:4px 0;color:#475569">Type: <code>${recordType}</code></p>
        <p style="margin:4px 0;color:#475569">Value: <code>${recordValue}</code></p>
      </div>
      <p style="color:#64748b">You can now manage your subdomain from the Open Domains dashboard. Future changes require admin approval.</p>
    </div>
    <div class="footer">Open Domains · Free Subdomain Management</div>
  </div></body></html>`;
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { request_id, admin_notes } = await req.json();
    const reviewerName = user.display_name || user.full_name || user.email;
    const request = await platform.asServiceRole.entities.SubdomainRequest.filter({ id: request_id });
    if (!request.length)
        return Response.json({ error: 'Request not found' }, { status: 404 });
    const r = request[0];
    const domains = await platform.asServiceRole.entities.Domain.filter({ name: r.root_domain });
    if (!domains.length)
        return Response.json({ error: 'Domain not found' }, { status: 404 });
    const domain = domains[0];
    // Normalise content: strip trailing dots for hostname-based records
    const hostnameTypes = ['NS', 'CNAME', 'MX'];
    let cfContent = hostnameTypes.includes(r.record_type)
        ? r.record_value.trim().replace(/\.$/, '')
        : r.record_value.trim();
    // MX: extract priority from "10 mail.example.com" or auto-assign 10
    let mxPriority;
    if (r.record_type === 'MX') {
        const mxMatch = cfContent.match(/^(\d+)\s+(.+)$/);
        if (mxMatch) {
            mxPriority = parseInt(mxMatch[1]);
            cfContent = mxMatch[2].trim();
        }
        else {
            mxPriority = 10;
        }
    }
    // NS and MX records cannot be proxied
    const cfProxied = (r.record_type === 'NS' || r.record_type === 'MX') ? false : (r.proxied || false);
    // Create DNS record in Cloudflare
    const cfBody = { type: r.record_type, name: `${r.subdomain}.${r.root_domain}`, content: cfContent, ttl: r.ttl || 3600, proxied: cfProxied };
    if (r.record_type === 'MX')
        cfBody.priority = mxPriority;
    const cfRes = await cfFetch('POST', `/zones/${domain.zone_id}/dns_records`, cfBody);
    if (!cfRes.success) {
        return Response.json({ error: cfRes.errors?.[0]?.message || 'Cloudflare error' }, { status: 500 });
    }
    const cfRecord = cfRes.result;
    // Upsert DNS record in DB
    const existing = await platform.asServiceRole.entities.DnsRecord.filter({ cloudflare_record_id: cfRecord.id });
    let dnsRecord;
    const dbPayload = {
        zone_id: domain.zone_id, zone_name: r.root_domain,
        cloudflare_record_id: cfRecord.id, record_type: r.record_type,
        name: cfRecord.name, subdomain: r.subdomain, content: r.record_value,
        proxied: r.proxied || false, ttl: r.ttl || 3600, managed: true,
        owner_email: r.requester_email, owner_id: r.requester_id,
        status: 'active', last_synced: new Date().toISOString()
    };
    if (existing.length) {
        dnsRecord = await platform.asServiceRole.entities.DnsRecord.update(existing[0].id, dbPayload);
    }
    else {
        dnsRecord = await platform.asServiceRole.entities.DnsRecord.create(dbPayload);
    }
    const fullName = `${r.subdomain}.${r.root_domain}`.toLowerCase();
    const ownerships = await platform.asServiceRole.entities.SubdomainOwnership.filter({ owner_id: r.requester_id, full_name: fullName });
    const ownershipPayload = {
        full_name: fullName, subdomain: r.subdomain, root_domain: r.root_domain, zone_id: domain.zone_id,
        owner_email: r.requester_email, owner_id: r.requester_id, status: 'active',
        suspended_at: null, suspension_reason: '', last_record_added_at: new Date().toISOString()
    };
    if (ownerships.length)
        await platform.asServiceRole.entities.SubdomainOwnership.update(ownerships[0].id, ownershipPayload);
    else
        await platform.asServiceRole.entities.SubdomainOwnership.create(ownershipPayload);
    // Update request
    await platform.asServiceRole.entities.SubdomainRequest.update(r.id, {
        status: 'approved', reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString(),
        cloudflare_record_id: cfRecord.id,
        dns_record_id: dnsRecord.id,
        admin_notes: admin_notes || ''
    });
    // Send approval email
    try {
        await platform.asServiceRole.integrations.Core.SendEmail({
            to: r.requester_email,
            subject: `✅ Subdomain Approved: ${r.subdomain}.${r.root_domain}`,
            body: approvalEmailHtml(r.subdomain, r.root_domain, r.record_type, r.record_value)
        });
        await platform.asServiceRole.entities.EmailLog.create({
            to: r.requester_email, subject: `✅ Subdomain Approved: ${r.subdomain}.${r.root_domain}`,
            template_type: 'request_approved', status: 'sent',
            related_entity_type: 'SubdomainRequest', related_entity_id: r.id
        });
    }
    catch (e) {
        await platform.asServiceRole.entities.EmailLog.create({
            to: r.requester_email, subject: `Subdomain Approved`, template_type: 'request_approved',
            status: 'failed', error_message: e.message
        });
    }
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'admin',
        action: 'request_approved', entity_type: 'SubdomainRequest', entity_id: r.id,
        description: `Approved by ${reviewerName}: ${r.subdomain}.${r.root_domain}`
    });
    // Discord notification
    try {
        const discordSettings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_webhook_url' });
        const discordUrl = discordSettings?.[0]?.value;
        if (discordUrl) {
            const discordEmbed = {
                title: 'Request Approved',
                color: 0x10b981,
                fields: [
                    { name: 'Subdomain', value: String(r.subdomain + '.' + r.root_domain), inline: true },
                    { name: 'Type', value: String(r.record_type), inline: true },
                    { name: 'User', value: String(r.requester_email), inline: true },
                    { name: 'Approved By', value: String(reviewerName), inline: true }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'Open Domains Platform' }
            };
            await fetch(discordUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [discordEmbed] })
            });
        }
    }
    catch (_) { }
    return Response.json({ success: true, dns_record: dnsRecord });
}
