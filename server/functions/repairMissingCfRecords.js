import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { cloudflareFetch as cfFetch } from '../lib/cloudflare.js';
import { listAllEntities, syncOwnershipForNamespace } from '../lib/subdomain-ownership.js';
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me();
        if (!user || user.role !== 'admin')
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        const approved = await listAllEntities(platform.asServiceRole.entities.SubdomainRequest, { status: 'approved' }, '-created_date');
        const broken = approved.filter(r => !Array.isArray(r.records) && !r.cloudflare_record_id && !r.dns_record_id);
        const results = { fixed: [], failed: [] };
        for (const r of broken) {
            try {
                const hostnameTypes = ['NS', 'CNAME', 'MX'];
                let cfContent = hostnameTypes.includes(r.record_type)
                    ? r.record_value.trim().replace(/\.$/, '')
                    : r.record_value.trim();
                let mxPriority;
                if (r.record_type === 'MX') {
                    const mxMatch = cfContent.match(/^(\d+)\s+(.+)$/);
                    if (mxMatch) {
                        mxPriority = parseInt(mxMatch[1]);
                        cfContent = mxMatch[2].trim();
                    }
                    else {
                        mxPriority = 10;
                    }
                }
                const cfProxied = (r.record_type === 'NS' || r.record_type === 'MX') ? false : (r.proxied || false);
                const fullName = r.full_name || `${r.subdomain}.${r.root_domain}`;
                const cfBody = {
                    type: r.record_type,
                    name: fullName,
                    content: cfContent,
                    ttl: r.ttl || 3600,
                    proxied: cfProxied
                };
                if (r.record_type === 'MX')
                    cfBody.priority = mxPriority;
                const cfRes = await cfFetch('POST', `/zones/${r.zone_id}/dns_records`, cfBody);
                if (!cfRes.success) {
                    results.failed.push({ full_name: fullName, error: cfRes.errors?.[0]?.message || 'CF error' });
                    continue;
                }
                const cfRecord = cfRes.result;
                const dnsRecord = await platform.asServiceRole.entities.DnsRecord.create({
                    zone_id: r.zone_id, zone_name: r.root_domain,
                    cloudflare_record_id: cfRecord.id, record_type: r.record_type,
                    name: cfRecord.name, subdomain: r.subdomain, content: r.record_value,
                    proxied: r.proxied || false, ttl: r.ttl || 3600, managed: true,
                    owner_email: r.requester_email, owner_id: r.requester_id,
                    status: 'active', last_synced: new Date().toISOString()
                });
                await platform.asServiceRole.entities.SubdomainRequest.update(r.id, {
                    cloudflare_record_id: cfRecord.id,
                    dns_record_id: dnsRecord.id
                });
                await syncOwnershipForNamespace(platform, {
                    owner: { id: r.requester_id, email: r.requester_email },
                    fullName,
                    zone: { name: r.root_domain, zone_id: r.zone_id },
                });
                await platform.asServiceRole.entities.AuditLog.create({
                    actor_email: user.email, actor_role: 'admin',
                    action: 'repair_missing_cf_record', entity_type: 'SubdomainRequest', entity_id: r.id,
                    description: `Repaired missing CF record for ${fullName} (cf_id: ${cfRecord.id})`
                });
                results.fixed.push({ full_name: fullName, cf_id: cfRecord.id });
            }
            catch (e) {
                results.failed.push({ full_name: r.full_name, error: e.message });
            }
        }
        return Response.json({ success: true, total_broken: broken.length, ...results });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
