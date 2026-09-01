import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { cloudflareGet as cfFetch } from '../lib/cloudflare.js';
const delay = (ms) => new Promise(r => setTimeout(r, ms));
// Run items in chunks of `size`, with a pause between chunks to avoid rate limits
async function chunkUpdates(items, size, fn) {
    for (let i = 0; i < items.length; i += size) {
        const chunk = items.slice(i, i + size);
        await Promise.all(chunk.map(fn));
        if (i + size < items.length)
            await delay(1000);
    }
}
async function syncDomain(platform, domain) {
    const syncLog = await platform.asServiceRole.entities.SyncLog.create({
        zone_id: domain.zone_id, zone_name: domain.name, status: 'running', triggered_by: 'scheduler'
    });
    try {
        // Fetch all CF records (paginated)
        let page = 1, allRecords = [], hasMore = true;
        while (hasMore) {
            const data = await cfFetch(`/zones/${domain.zone_id}/dns_records?per_page=100&page=${page}`);
            if (!data.success)
                throw new Error(data.errors?.[0]?.message || 'Cloudflare API error');
            allRecords = allRecords.concat(data.result);
            hasMore = data.result_info.page < data.result_info.total_pages;
            page++;
        }
        // Fetch ALL existing DB records for this zone
        const existingRecords = await platform.asServiceRole.entities.DnsRecord.filter({ zone_id: domain.zone_id }, null, 2000);
        const existingMap = {};
        for (const r of existingRecords) {
            if (r.cloudflare_record_id)
                existingMap[r.cloudflare_record_id] = r;
        }
        // Diff: only create/update what changed
        const toCreate = [];
        const toUpdate = [];
        const now = new Date().toISOString();
        for (const rec of allRecords) {
            const subdomain = rec.name.replace(`.${domain.name}`, '').replace(domain.name, '@');
            const payload = {
                zone_id: domain.zone_id, zone_name: domain.name,
                cloudflare_record_id: rec.id, record_type: rec.type,
                name: rec.name, subdomain, content: rec.content,
                proxied: rec.proxied || false, ttl: rec.ttl,
                priority: rec.priority || null, last_synced: now
            };
            const existing = existingMap[rec.id];
            if (!existing) {
                toCreate.push({ ...payload, managed: false });
            }
            else {
                const changed = existing.content !== rec.content ||
                    existing.record_type !== rec.type ||
                    existing.proxied !== (rec.proxied || false) ||
                    existing.ttl !== rec.ttl ||
                    (existing.priority || null) !== (rec.priority || null);
                if (changed)
                    toUpdate.push({ id: existing.id, payload });
            }
        }
        // bulkCreate new records in one call
        let added = 0;
        if (toCreate.length > 0) {
            await platform.asServiceRole.entities.DnsRecord.bulkCreate(toCreate);
            added = toCreate.length;
        }
        // Update changed records in parallel chunks of 5
        let updated = 0;
        if (toUpdate.length > 0) {
            await chunkUpdates(toUpdate, 5, async ({ id, payload }) => {
                await platform.asServiceRole.entities.DnsRecord.update(id, payload);
                updated++;
            });
        }
        await Promise.all([
            platform.asServiceRole.entities.SyncLog.update(syncLog.id, {
                status: 'completed', records_synced: allRecords.length,
                records_added: added, records_updated: updated,
                completed_at: new Date().toISOString()
            }),
            platform.asServiceRole.entities.Domain.update(domain.id, {
                last_synced: new Date().toISOString(), record_count: allRecords.length
            })
        ]);
        return { zone: domain.name, status: 'completed', records: allRecords.length, added, updated };
    }
    catch (err) {
        await platform.asServiceRole.entities.SyncLog.update(syncLog.id, {
            status: 'failed', error_message: err.message, completed_at: new Date().toISOString()
        });
        return { zone: domain.name, status: 'failed', error: err.message };
    }
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const domains = await platform.asServiceRole.entities.Domain.filter({ status: 'active' });
    if (!domains.length)
        return Response.json({ message: 'No active domains to sync' });
    // Process all domains in parallel
    const results = await Promise.all(domains.map(domain => syncDomain(platform, domain)));
    return Response.json({ success: true, results });
}
