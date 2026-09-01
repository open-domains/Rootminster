import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { cloudflareFetch as cfFetch } from '../lib/cloudflare.js';
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me();
        if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { record_id, content, ttl, proxied } = await req.json();
        if (!record_id) {
            return Response.json({ error: 'record_id is required' }, { status: 400 });
        }
        if (content === undefined && ttl === undefined && proxied === undefined) {
            return Response.json({ error: 'At least one of content, ttl, or proxied must be provided' }, { status: 400 });
        }
        const records = await platform.asServiceRole.entities.DnsRecord.filter({ id: record_id });
        if (!records.length) {
            return Response.json({ error: 'DNS record not found' }, { status: 404 });
        }
        const dnsRecord = records[0];
        if (!dnsRecord.cloudflare_record_id || !dnsRecord.zone_id) {
            return Response.json({ error: 'Record is missing Cloudflare linkage' }, { status: 422 });
        }
        // Resolve final values
        const finalContent = content !== undefined ? String(content) : dnsRecord.content;
        const finalTtl = ttl !== undefined ? Number(ttl) : dnsRecord.ttl;
        const finalProxied = proxied !== undefined ? Boolean(proxied) : dnsRecord.proxied;
        // MX content may be "priority host" — split for Cloudflare
        let cfContent = finalContent;
        let mxPriority;
        if (dnsRecord.record_type === 'MX') {
            const mxMatch = cfContent.match(/^(\d+)\s+(.+)$/);
            if (mxMatch) {
                mxPriority = parseInt(mxMatch[1]);
                cfContent = mxMatch[2].trim();
            }
            else {
                mxPriority = 10;
            }
        }
        const cfBody = {
            type: dnsRecord.record_type,
            name: dnsRecord.name,
            content: cfContent,
            ttl: finalTtl,
            proxied: finalProxied
        };
        if (dnsRecord.record_type === 'MX')
            cfBody.priority = mxPriority;
        const cfRes = await cfFetch('PUT', `/zones/${dnsRecord.zone_id}/dns_records/${dnsRecord.cloudflare_record_id}`, cfBody);
        if (!cfRes.success) {
            const errMsg = cfRes.errors?.[0]?.message || 'Cloudflare error';
            return Response.json({ error: `Cloudflare update failed: ${errMsg}` }, { status: 502 });
        }
        const dbUpdates = { last_synced: new Date().toISOString() };
        if (content !== undefined)
            dbUpdates.content = finalContent;
        if (ttl !== undefined)
            dbUpdates.ttl = finalTtl;
        if (proxied !== undefined)
            dbUpdates.proxied = finalProxied;
        await platform.asServiceRole.entities.DnsRecord.update(dnsRecord.id, dbUpdates);
        await platform.asServiceRole.entities.AuditLog.create({
            actor_email: user.email,
            actor_role: user.role,
            action: 'dns_record_updated',
            entity_type: 'DnsRecord',
            entity_id: dnsRecord.id,
            description: `Updated DNS record ${dnsRecord.name} (${dnsRecord.record_type}) via staff API`,
            old_value: JSON.stringify({ content: dnsRecord.content, ttl: dnsRecord.ttl, proxied: dnsRecord.proxied }),
            new_value: JSON.stringify({ content: finalContent, ttl: finalTtl, proxied: finalProxied })
        });
        return Response.json({
            success: true,
            record: {
                id: dnsRecord.id,
                name: dnsRecord.name,
                record_type: dnsRecord.record_type,
                content: finalContent,
                ttl: finalTtl,
                proxied: finalProxied
            }
        });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
