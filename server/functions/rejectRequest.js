import { createPlatformClientFromRequest } from '../lib/platform-client.js';
function rejectionEmailHtml(subdomain, domain, reason, reviewerName) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;margin:0;padding:0}
  .container{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);padding:40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:28px;font-weight:700}
  .badge{display:inline-block;background:#fee2e2;color:#991b1b;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:24px}
  .body{padding:40px}
  .reason-box{background:#fff7f7;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:20px 0}
  .footer{text-align:center;padding:24px;color:#94a3b8;font-size:13px;border-top:1px solid #f1f5f9}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>Request Rejected</h1><p style="color:rgba(255,255,255,.85)">Open Domains Platform</p></div>
    <div class="body">
      <span class="badge">✗ REJECTED</span>
      <h2 style="margin:0 0 8px;color:#1e293b">Your subdomain request was not approved</h2>
      <p style="color:#64748b">Unfortunately, your request for <strong>${subdomain}.${domain}</strong> could not be approved at this time.</p>
      ${reason ? `<div class="reason-box"><p style="margin:0 0 8px;font-weight:600;color:#991b1b">Reason</p><p style="margin:0;color:#475569">${reason}</p></div>` : ''}
      <p style="color:#64748b">You may submit a new request with updated information. Contact support if you have questions.</p>
      ${reviewerName ? `<p style="color:#94a3b8;font-size:13px;margin-top:24px">Reviewed by <strong>${reviewerName}</strong></p>` : ''}
    </div>
    <div class="footer">Open Domains · Free Subdomain Management</div>
  </div></body></html>`;
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
    const r = requests[0];
    if (!['pending', 'needs_info', 'user_responded'].includes(r.status))
        return Response.json({ error: `Request cannot be rejected from status ${r.status || 'unknown'}` }, { status: 409 });
    const reviewerName = user.full_name || user.email;
    await platform.asServiceRole.entities.SubdomainRequest.update(r.id, {
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
}
