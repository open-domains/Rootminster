import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { cloudflareFetch as cfFetch } from '../lib/cloudflare.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { zone_id, record_id, method, payload } = await req.json();
    if (!zone_id || !method) {
        return Response.json({ error: 'Missing zone_id or method' }, { status: 400 });
    }
    let path;
    if (method === 'POST') {
        path = `/zones/${zone_id}/dns_records`;
    }
    else if (method === 'PATCH' || method === 'PUT') {
        path = `/zones/${zone_id}/dns_records/${record_id}`;
    }
    else if (method === 'DELETE') {
        path = `/zones/${zone_id}/dns_records/${record_id}`;
    }
    else {
        return Response.json({ error: 'Invalid method' }, { status: 400 });
    }
    const result = await cfFetch(method, path, payload);
    return Response.json(result);
}
