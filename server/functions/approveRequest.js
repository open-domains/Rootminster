import { provisionRequestBundle } from '../lib/request-approval.js';
import { withRequestLock } from '../lib/request-bundles.js';
import { requestHostname } from '../../shared/subdomain-requests.js';
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { cloudflareFetch as cfFetch } from '../lib/cloudflare.js';
import { notifyRequestApproved } from '../lib/request-notifications.js';
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
    await notifyRequestApproved(platform, r, bundle, reviewerName, user);
    return Response.json({ success: true, dns_record: dnsRecords[0], dns_records: dnsRecords });
    });
}
