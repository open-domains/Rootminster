import { createPlatformClientFromRequest } from '../lib/platform-client.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { request_id, appeal_message } = await req.json();
    if (!request_id || !appeal_message?.trim()) {
        return Response.json({ error: 'Missing fields' }, { status: 400 });
    }
    const requests = await platform.entities.SubdomainRequest.filter({ id: request_id });
    if (!requests.length)
        return Response.json({ error: 'Request not found' }, { status: 404 });
    const r = requests[0];
    if (r.requester_email !== user.email)
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (r.status !== 'rejected')
        return Response.json({ error: 'Can only appeal rejected requests' }, { status: 400 });
    // Re-open the request as pending
    await platform.entities.SubdomainRequest.update(request_id, {
        status: 'pending',
        rejection_reason: null,
    });
    // Post appeal as a comment
    await platform.asServiceRole.entities.RequestComment.create({
        request_id,
        request_type: 'subdomain',
        author_email: user.email,
        author_role: user.role || 'user',
        message: `**Appeal:** ${appeal_message.trim()}`,
        is_internal: false,
        message_type: 'reply',
    });
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'user',
        action: 'appeal_submitted', entity_type: 'SubdomainRequest', entity_id: request_id,
        description: `Appeal submitted for ${r.subdomain}.${r.root_domain}`
    });
    return Response.json({ success: true });
}
