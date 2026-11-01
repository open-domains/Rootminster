import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { recheckInstantApprovals } from '../lib/instant-approval.js';

// Scheduled job: re-scan instantly approved hostnames and pull flagged ones back to review.
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || user.role !== 'admin')
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    const summary = await recheckInstantApprovals(platform);
    return Response.json({ success: true, ...summary });
}
