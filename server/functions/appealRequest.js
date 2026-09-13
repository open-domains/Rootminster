import { requestBundle, withRequestLock } from '../lib/request-bundles.js';
import { OPEN_REQUEST_STATUSES, recordSetError, requestHostname } from '../../shared/subdomain-requests.js';
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
    return withRequestLock(requestHostname(r), async () => {
    const bundle = await requestBundle(platform.asServiceRole.entities, await platform.entities.SubdomainRequest.get(request_id));
    if (bundle._requests.some(row => row.status !== 'rejected')) return Response.json({ error: 'Can only appeal rejected requests' }, { status: 409 });
    const conflict = recordSetError(bundle._records);
    if (conflict) return Response.json({ error: `${conflict} Submit a corrected request instead.` }, { status: 409 });
    const existing = await platform.entities.SubdomainRequest.filter({ subdomain: r.subdomain, root_domain: r.root_domain, status: { $in: OPEN_REQUEST_STATUSES } });
    if (existing.length) return Response.json({ error: 'An open request already exists for this hostname.' }, { status: 409 });
    // Re-open the whole request as pending
    for (const row of bundle._requests) await platform.entities.SubdomainRequest.update(row.id, {
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
    });
}
