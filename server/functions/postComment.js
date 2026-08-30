import { createPlatformClientFromRequest } from '../lib/platform-client.js';
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
function needsInfoEmailHtml(subdomain, domain, question, staffEmail) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;margin:0;padding:0}
  .container{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:24px;font-weight:700}
  .badge{display:inline-block;background:#fef3c7;color:#92400e;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:20px}
  .body{padding:40px}
  .msg-box{background:#f8fafc;border-left:4px solid #667eea;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0}
  .footer{text-align:center;padding:24px;color:#94a3b8;font-size:13px;border-top:1px solid #f1f5f9}
  </style></head><body>
  <div class="container">
    <div class="header"><h1>💬 Question About Your Request</h1></div>
    <div class="body">
      <span class="badge">⏳ NEEDS INFO</span>
      <h2 style="margin:0 0 8px;color:#1e293b">Our team has a question</h2>
      <p style="color:#64748b">Regarding your subdomain request for <strong>${escapeHtml(subdomain)}.${escapeHtml(domain)}</strong>, our review team needs some clarification before proceeding.</p>
      <div class="msg-box">
        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8">From ${escapeHtml(staffEmail)}:</p>
        <p style="margin:0;color:#1e293b">${escapeHtml(question)}</p>
      </div>
      <p style="color:#64748b">Please log in to your dashboard and reply to this question to continue the review process.</p>
    </div>
    <div class="footer">Open Domains · Free Subdomain Management</div>
  </div></body></html>`;
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { request_id, request_type, message, is_internal, message_type, notify_user, notify_staff } = await req.json();
    if (!request_id || !message)
        return Response.json({ error: 'Missing fields' }, { status: 400 });
    // Internal notes only for staff/admin
    const canInternal = user.role === 'admin' || user.role === 'staff';
    const isInternal = is_internal && canInternal;
    const comment = await platform.asServiceRole.entities.RequestComment.create({
        request_id,
        request_type: request_type || 'subdomain',
        author_email: user.email,
        author_role: user.role || 'user',
        message,
        is_internal: isInternal,
        message_type: message_type || 'comment'
    });
    // If staff/admin is asking for info → update request status to needs_info and email user.
    // Cover all sibling records in the same group so the whole request waits for a reply.
    if ((user.role === 'admin' || user.role === 'staff') && message_type === 'question' && notify_user) {
        const entity = platform.asServiceRole.entities.SubdomainRequest;
        const requests = await entity.filter({ id: request_id });
        if (requests.length) {
            const r = requests[0];
            const siblings = await entity.filter({
                requester_email: r.requester_email,
                subdomain: r.subdomain,
                root_domain: r.root_domain
            });
            const toUpdate = siblings.filter(s => ['pending', 'user_responded'].includes(s.status));
            await Promise.all(toUpdate.map(s => entity.update(s.id, { status: 'needs_info' })));
            try {
                await platform.asServiceRole.integrations.Core.SendEmail({
                    to: r.requester_email,
                    subject: `Question about your request: ${r.subdomain || r.subdomain_name}.${r.root_domain}`,
                    body: needsInfoEmailHtml(r.subdomain || r.subdomain_name, r.root_domain, message, user.email)
                });
                await platform.asServiceRole.entities.EmailLog.create({
                    to: r.requester_email, subject: 'Question about your request',
                    template_type: 'needs_info', status: 'sent',
                    related_entity_type: 'SubdomainRequest', related_entity_id: r.id
                });
            }
            catch (e) {
                await platform.asServiceRole.entities.EmailLog.create({
                    to: r.requester_email, subject: 'Question about your request',
                    template_type: 'needs_info', status: 'failed', error_message: e.message
                });
            }
        }
    }
    // If user is replying → update status to user_responded. Staff/admin email notifications are disabled.
    if (user.role === 'user' && message_type === 'reply' && notify_staff) {
        const entity = platform.asServiceRole.entities.SubdomainRequest;
        const requests = await entity.filter({ id: request_id });
        if (requests.length) {
            const r = requests[0];
            if (r.status === 'needs_info') {
                await entity.update(r.id, { status: 'user_responded' });
            }
        }
    }
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'user',
        action: 'comment_posted', entity_type: 'RequestComment', entity_id: comment.id,
        description: `${message_type || 'comment'} on ${request_type} request ${request_id}`
    });
    return Response.json({ success: true, comment });
}
