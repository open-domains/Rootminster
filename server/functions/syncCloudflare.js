import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { cloudflareGet as cfFetch } from '../lib/cloudflare.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { zone_id, zone_name } = await req.json();
    // Create sync log entry
    const syncLog = await platform.asServiceRole.entities.SyncLog.create({
        zone_id, zone_name, status: 'running', triggered_by: user.email
    });
    try {
        let page = 1, allRecords = [], hasMore = true;
        while (hasMore) {
            const data = await cfFetch(`/zones/${zone_id}/dns_records?per_page=100&page=${page}`);
            if (!data.success)
                throw new Error(data.errors?.[0]?.message || 'Cloudflare API error');
            allRecords = allRecords.concat(data.result);
            hasMore = data.result_info.page < data.result_info.total_pages;
            page++;
        }
        let added = 0, updated = 0;
        for (const rec of allRecords) {
            const subdomain = rec.name.replace(`.${zone_name}`, '').replace(zone_name, '@');
            const existing = await platform.asServiceRole.entities.DnsRecord.filter({ cloudflare_record_id: rec.id });
            const payload = {
                zone_id, zone_name,
                cloudflare_record_id: rec.id,
                record_type: rec.type,
                name: rec.name,
                subdomain,
                content: rec.content,
                proxied: rec.proxied || false,
                ttl: rec.ttl,
                priority: rec.priority || null,
                last_synced: new Date().toISOString()
            };
            if (existing.length > 0) {
                await platform.asServiceRole.entities.DnsRecord.update(existing[0].id, payload);
                updated++;
            }
            else {
                await platform.asServiceRole.entities.DnsRecord.create({ ...payload, managed: false });
                added++;
            }
        }
        await platform.asServiceRole.entities.SyncLog.update(syncLog.id, {
            status: 'completed', records_synced: allRecords.length,
            records_added: added, records_updated: updated,
            completed_at: new Date().toISOString()
        });
        await platform.asServiceRole.entities.Domain.filter({ zone_id }).then(async (domains) => {
            if (domains.length > 0) {
                await platform.asServiceRole.entities.Domain.update(domains[0].id, {
                    last_synced: new Date().toISOString(), record_count: allRecords.length
                });
            }
        });
        await platform.asServiceRole.entities.AuditLog.create({
            actor_email: user.email, actor_role: 'admin',
            action: 'sync_completed', entity_type: 'Domain', entity_id: zone_id,
            description: `Synced ${allRecords.length} records from ${zone_name}`
        });
        return Response.json({ success: true, records_synced: allRecords.length, added, updated });
    }
    catch (err) {
        await platform.asServiceRole.entities.SyncLog.update(syncLog.id, {
            status: 'failed', error_message: err.message, completed_at: new Date().toISOString()
        });
        return Response.json({ error: err.message }, { status: 500 });
    }
}
