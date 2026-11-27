import { requestBundle, ensureRequestGroup, withRequestLock } from '../lib/request-bundles.js';
import { OPEN_REQUEST_STATUSES, requestHostname } from '../../shared/subdomain-requests.js';
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../core/config.js';
import { platformName } from '../lib/platform-name.js';
import { requestQuestionEmail } from '../../shared/email-templates.js';
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
function publicComment(comment) {
    if (!comment) return comment;
    if (comment.author_role === 'staff' || comment.author_role === 'admin') {
        const { author_email, ...safe } = comment;
        return { ...safe, author_name: 'Open Domains staff' };
    }
    return comment;
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { request_id, request_type, message, is_internal, message_type, notify_user } = await req.json();
    if (!request_id || !message)
        return Response.json({ error: 'Missing fields' }, { status: 400 });
    const elevated = user.role === 'admin' || user.role === 'staff';
    const targetEntity = request_type === 'edit' ? 'EditRequest' : 'SubdomainRequest';
    const target = await platform.asServiceRole.entities[targetEntity].get(request_id);
    if (!target)
        return Response.json({ error: 'Request not found' }, { status: 404 });
    const ownsRequest = target.requester_id ? target.requester_id === user.id : String(target.requester_email || '').toLowerCase() === String(user.email || '').toLowerCase();
    if (!elevated && !ownsRequest)
        return Response.json({ error: 'Request not found' }, { status: 404 });
    if (!elevated && !['comment', 'reply'].includes(message_type || 'comment'))
        return Response.json({ error: 'This message type requires staff access' }, { status: 403 });
    if (String(message).length > 5000)
        return Response.json({ error: 'Message must be 5000 characters or fewer' }, { status: 400 });
    const post = async () => {
    const fresh = await platform.asServiceRole.entities[targetEntity].get(request_id);
    const bundle = targetEntity === 'SubdomainRequest' ? await requestBundle(platform.asServiceRole.entities, fresh) : null;
    if (bundle) await ensureRequestGroup(platform.asServiceRole.entities, bundle);
    const canonicalId = bundle?.id || request_id;
    const canInternal = elevated;
    const isInternal = is_internal && canInternal;
    const comment = await platform.asServiceRole.entities.RequestComment.create({
        request_id: canonicalId,
        request_type: request_type || 'subdomain',
        author_email: user.email,
        author_role: user.role || 'user',
        message,
        is_internal: isInternal,
        message_type: message_type || 'comment'
    });
    if ((user.role === 'admin' || user.role === 'staff') && message_type === 'question' && !isInternal) {
        const entity = platform.asServiceRole.entities.SubdomainRequest;
        const requests = targetEntity === 'SubdomainRequest' ? [target] : [];
        if (requests.length) {
            const r = target;
            const toUpdate = bundle._requests.filter(s => OPEN_REQUEST_STATUSES.includes(s.status));
            if (!isInternal) await Promise.all(toUpdate.map(s => entity.update(s.id, { status: 'needs_info' })));
            if (notify_user) try {
                await platform.asServiceRole.integrations.Core.SendEmail({
                    to: r.requester_email,
                    ...requestQuestionEmail({ platform: await platformName(), appUrl: config.appUrl, hostname: `${r.subdomain || r.subdomain_name}.${r.root_domain}`, question: message })
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
    if (!elevated && !isInternal && bundle) {
        for (const row of bundle._requests.filter(row => OPEN_REQUEST_STATUSES.includes(row.status))) {
            await platform.asServiceRole.entities.SubdomainRequest.update(row.id, { status: 'user_responded' });
        }
    }
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'user',
        action: 'comment_posted', entity_type: 'RequestComment', entity_id: comment.id,
        description: `${message_type || 'comment'} on ${request_type} request ${request_id}`
    });
    return Response.json({ success: true, comment: elevated ? comment : publicComment(comment) });
    };
    return targetEntity === 'SubdomainRequest' ? withRequestLock(requestHostname(target), post) : post();
}
