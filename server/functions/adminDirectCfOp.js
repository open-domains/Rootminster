import { createPlatformClientFromRequest } from '../lib/platform-client.js';
const CF_BASE = 'https://api.cloudflare.com/client/v4';
const CF_TOKEN = process.env['CLOUDFLARE_API_TOKEN'];
async function cfFetch(method, path, body) {
    const res = await fetch(`${CF_BASE}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
}
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
