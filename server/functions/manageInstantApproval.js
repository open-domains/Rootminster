import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { withRequestLock } from '../lib/request-bundles.js';
import { revokeInstantApproval } from '../lib/instant-approval.js';
import { requestHostname } from '../../shared/subdomain-requests.js';

// Staff undo: pull an instantly approved request back to the review queue.
export default async function (req) {
    if (req.method !== 'POST')
        return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || !['admin', 'staff'].includes(user.role))
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { action, request_id, reason } = await req.json();
    if (action !== 'revoke')
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    const note = String(reason || '').trim().slice(0, 500);
    if (!note)
        return Response.json({ error: 'Give a reason for pulling this request back to review' }, { status: 400 });
    const request = await platform.asServiceRole.entities.SubdomainRequest.get(request_id);
    if (!request)
        return Response.json({ error: 'Request not found' }, { status: 404 });
    return withRequestLock(requestHostname(request), async () => {
        const current = await platform.asServiceRole.entities.SubdomainRequest.get(request_id);
        if (current?.status !== 'approved' || current.safety_auto_decision !== 'approved')
            return Response.json({ error: 'Only live, instantly approved requests can be pulled back' }, { status: 409 });
        try {
            const { removed } = await revokeInstantApproval(platform, current, {
                reason: `${user.full_name || user.email}: ${note}`,
                actor: user,
            });
            return Response.json({ success: true, removed: removed.length });
        } catch (error) {
            return Response.json({ error: error.message }, { status: error.status || 500 });
        }
    });
}
