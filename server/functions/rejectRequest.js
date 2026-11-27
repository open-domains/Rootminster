import { requestBundle, ensureRequestGroup, withRequestLock } from '../lib/request-bundles.js';
import { requestHostname, requestRecords } from '../../shared/subdomain-requests.js';
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../core/config.js';
import { platformName } from '../lib/platform-name.js';
import { requestRejectedEmail } from '../../shared/email-templates.js';
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
            ...requestRejectedEmail({ platform: await platformName(), appUrl: config.appUrl, hostname: `${r.subdomain}.${r.root_domain}`, reason: rejection_reason, reviewerName })
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
