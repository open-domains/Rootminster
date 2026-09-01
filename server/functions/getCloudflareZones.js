import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { cloudflareGet } from '../lib/cloudflare.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Paginate through all zones
    let page = 1, allZones = [], hasMore = true;
    while (hasMore) {
        const data = await cloudflareGet(`/zones?per_page=50&page=${page}`);
        if (!data.success) {
            return Response.json({ error: data.errors?.[0]?.message || 'Cloudflare API error' }, { status: 500 });
        }
        allZones = allZones.concat(data.result);
        hasMore = data.result_info.page < data.result_info.total_pages;
        page++;
    }
    const zones = allZones.map(z => ({ id: z.id, name: z.name, status: z.status, nameservers: z.name_servers }));
    return Response.json({ success: true, zones });
}
