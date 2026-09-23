import { provisionRequestBundle } from '../lib/request-approval.js';
import { withRequestLock } from '../lib/request-bundles.js';
import { requestHostname } from '../../shared/subdomain-requests.js';
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { cloudflareFetch as cfFetch } from '../lib/cloudflare.js';
function approvalEmailHtml(subdomain, domain, recordType, recordValue) {
    const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const hostname = escape(`${subdomain}.${domain}`);
    return `<p style="color:#2fb344;font-weight:600">✓ Approved</p>
      <p>Your subdomain <strong>${hostname}</strong> is live and its DNS record is active.</p>
      <table role="presentation" width="100%" style="background:#f6f8fb;border:1px solid #dce1e7;border-radius:6px;padding:16px">
        <tr><td>Subdomain</td><td><code>${hostname}</code></td></tr>
        <tr><td>Type</td><td><code>${escape(recordType)}</code></td></tr>
        <tr><td>Value</td><td><code>${escape(recordValue)}</code></td></tr>
      </table><p>Manage your subdomain from your Open Domains dashboard. Future changes require admin approval.</p>`;
}
export default async function (req) {
    if (req.method !== 'POST')
        return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { request_id, admin_notes } = await req.json();
    const reviewerName = user.full_name || user.email;
    const request = await platform.asServiceRole.entities.SubdomainRequest.filter({ id: request_id });
    if (!request.length)
        return Response.json({ error: 'Request not found' }, { status: 404 });
    return withRequestLock(requestHostname(request[0]), async () => {
    const r = await platform.asServiceRole.entities.SubdomainRequest.get(request_id);
    let result;
    try {
        result = await provisionRequestBundle(platform.asServiceRole.entities, r, user, admin_notes, cfFetch);
    } catch (error) {
        return Response.json({ error: error.message }, { status: error.status || 500 });
    }
    const { bundle, dnsRecords } = result;
    const recordTypes = bundle._records.map(record => record.record_type).join(', ');
    const recordValues = bundle._records.map(record => record.record_value).join('; ');
    // Send approval email
    try {
        await platform.asServiceRole.integrations.Core.SendEmail({
            to: r.requester_email,
            subject: `✅ Subdomain Approved: ${r.subdomain}.${r.root_domain}`,
            body: approvalEmailHtml(r.subdomain, r.root_domain, recordTypes, recordValues)
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
                    { name: 'Type', value: recordTypes, inline: true },
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
    return Response.json({ success: true, dns_record: dnsRecords[0], dns_records: dnsRecords });
    });
}
