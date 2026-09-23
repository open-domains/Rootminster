import { requestBundle, ensureRequestGroup, withRequestLock } from '../lib/request-bundles.js';
import { requestHostname, requestRecords } from '../../shared/subdomain-requests.js';
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
function rejectionEmailHtml(subdomain, domain, reason, reviewerName) {
    const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    return `<p style="color:#d63939;font-weight:600">Request not approved</p>
      <p>Your request for <strong>${escape(`${subdomain}.${domain}`)}</strong> could not be approved at this time.</p>
      ${reason ? `<div style="background:#fff3f3;border:1px solid #f5c2c7;border-radius:6px;padding:16px"><strong>Reason</strong><p>${escape(reason)}</p></div>` : ''}
      <p>You may submit another request with updated information. Contact support if you have questions.</p>
      ${reviewerName ? `<p style="color:#667382;font-size:13px">Reviewed by ${escape(reviewerName)}</p>` : ''}`;
}
export default async function (req) {
    if (req.method !== 'POST')
        return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { request_id, rejection_reason, admin_notes } = await req.json();
    if (!rejection_reason || !rejection_reason.trim()) {
        return Response.json({ error: 'A rejection reason is required' }, { status: 400 });
    }
    const requests = await platform.asServiceRole.entities.SubdomainRequest.filter({ id: request_id });
    if (!requests.length)
        return Response.json({ error: 'Request not found' }, { status: 404 });
    return withRequestLock(requestHostname(requests[0]), async () => {
    const r = await platform.asServiceRole.entities.SubdomainRequest.get(request_id);
    const bundle = await requestBundle(platform.asServiceRole.entities, r);
    if (bundle._requests.some(row => requestRecords(row).some(record => record.cloudflare_record_id))) return Response.json({ error: 'DNS creation has already started. Resume approval or remove the created records before rejecting.' }, { status: 409 });
    await ensureRequestGroup(platform.asServiceRole.entities, bundle);
    if (!['pending', 'needs_info', 'user_responded'].includes(r.status))
        return Response.json({ error: `Request cannot be rejected from status ${r.status || 'unknown'}` }, { status: 409 });
    const reviewerName = user.full_name || user.email;
    for (const row of bundle._requests) await platform.asServiceRole.entities.SubdomainRequest.update(row.id, {
        status: 'rejected', reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejection_reason || '',
        admin_notes: admin_notes || ''
    });
    try {
        await platform.asServiceRole.integrations.Core.SendEmail({
            to: r.requester_email,
            subject: `Request Rejected: ${r.subdomain}.${r.root_domain}`,
            body: rejectionEmailHtml(r.subdomain, r.root_domain, rejection_reason, reviewerName)
        });
        await platform.asServiceRole.entities.EmailLog.create({
            to: r.requester_email, subject: `Request Rejected`,
            template_type: 'request_rejected', status: 'sent',
            related_entity_type: 'SubdomainRequest', related_entity_id: r.id
        });
    }
    catch (e) {
        await platform.asServiceRole.entities.EmailLog.create({
            to: r.requester_email, subject: `Request Rejected`, template_type: 'request_rejected',
            status: 'failed', error_message: e.message
        });
    }
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'admin',
        action: 'request_rejected', entity_type: 'SubdomainRequest', entity_id: r.id,
        description: `Rejected by ${reviewerName}: ${r.subdomain}.${r.root_domain}. Reason: ${rejection_reason}`
    });
    // Discord notification
    try {
        const discordSettings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_webhook_url' });
        const discordUrl = discordSettings?.[0]?.value;
        if (discordUrl) {
            const discordEmbed = {
                title: 'Request Rejected',
                color: 0xef4444,
                fields: [
                    { name: 'Subdomain', value: String(r.subdomain + '.' + r.root_domain), inline: true },
                    { name: 'User', value: String(r.requester_email), inline: true },
                    { name: 'Rejected By', value: String(reviewerName), inline: true },
                    { name: 'Reason', value: String(rejection_reason || 'No reason given'), inline: false }
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
    return Response.json({ success: true });
    });
}
