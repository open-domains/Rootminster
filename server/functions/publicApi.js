/**
 * Public API — all requests go through a single endpoint.
 * Authentication: Bearer token in Authorization header (for write operations).
 *
 * GET  /?action=check&subdomain=foo&domain=example.com
 * GET  /?action=records&domain=example.com
 * POST / { action: "submit", subdomain, root_domain, record_type, record_value, ttl?, proxied?, reason? }
 * POST / { action: "update", dns_record_id, new_content?, new_proxied?, new_ttl? }
 */
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { getRequestPolicy, isReservedName } from '../lib/request-policy.js';
import { invokeInternal } from '../function-runner.js';
import { apiIdentity, tokenHasScope, tokenAllowsRecord, tokenAllowsRequest } from '../public-api.js';
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/;
async function authorize(req, scope) {
    const identity = await apiIdentity({ headers: { authorization: req.headers.get('Authorization') || '' } });
    if (!identity) return { error: 'Unauthorized. Provide a valid API key in Authorization: Bearer <key>', status: 401 };
    if (!tokenHasScope(identity, scope)) return { error: `This API token requires the ${scope} scope`, status: 403 };
    return identity;
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const url = new URL(req.url);
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    const respond = (data, status = 200) => Response.json(data, { status, headers: corsHeaders });
    // ── GET actions (public, no auth) ─────────────────────────────
    if (req.method === 'GET') {
        const action = url.searchParams.get('action');
        // GET ?action=check&subdomain=foo&domain=example.com
        if (action === 'check') {
            const subdomain = url.searchParams.get('subdomain');
            const domain = url.searchParams.get('domain');
            if (!subdomain || !domain)
                return respond({ error: 'subdomain and domain required' }, 400);
            if (subdomain.length > 63 || !SUBDOMAIN_REGEX.test(subdomain)) {
                return respond({ status: 'invalid', message: 'Invalid subdomain format' });
            }
            const domains = await platform.asServiceRole.entities.Domain.filter({ name: domain });
            if (!domains.length)
                return respond({ status: 'invalid', message: 'Domain not found' }, 404);
            const requestPolicy = await getRequestPolicy(platform);
            if (requestPolicy.locked)
                return respond({ status: 'locked', message: requestPolicy.message });
            if (!domains[0].allow_new_requests)
                return respond({ status: 'locked', message: 'New requests are disabled for this domain' });
            const reserved = domains[0].reserved_names || [];
            if (isReservedName(subdomain, reserved)) {
                return respond({ status: 'reserved', message: 'This subdomain name is reserved' });
            }
            const fullName = `${subdomain}.${domain}`;
            const existing = await platform.asServiceRole.entities.DnsRecord.filter({ name: fullName });
            if (existing.length > 0)
                return respond({ status: 'taken', message: 'Subdomain is already in use' });
            const pending = await platform.asServiceRole.entities.SubdomainRequest.filter({ subdomain, root_domain: domain, status: 'pending' });
            if (pending.length > 0)
                return respond({ status: 'pending', message: 'Subdomain has a pending request' });
            return respond({ status: 'available', message: 'Subdomain is available' });
        }
        // GET ?action=whois&subdomain=foo&domain=example.com (staff/admin only)
        if (action === 'whois') {
            const subdomain = url.searchParams.get('subdomain');
            const domain = url.searchParams.get('domain');
            if (!subdomain || !domain)
                return respond({ error: 'subdomain and domain required' }, 400);
            const identity = await authorize(req, 'staff:read');
            if (identity.error) return respond({ error: identity.error }, identity.status);
            const { user, token } = identity;
            if (!user || !['admin', 'staff'].includes(user.role)) {
                return respond({ error: 'Forbidden. This endpoint is restricted to staff and admins.' }, 403);
            }
            const fullName = `${subdomain}.${domain}`;
            const records = await platform.asServiceRole.entities.DnsRecord.filter({ name: fullName });
            if (!records.length)
                return respond({ error: 'Subdomain not found' }, 404);
            const record = records[0];
            if (records.some(item => !tokenAllowsRecord(token, item)))
                return respond({ error: 'This token is not permitted to access that hostname or record type' }, 403);
            const requests = await platform.asServiceRole.entities.SubdomainRequest.filter({ subdomain, root_domain: domain });
            return respond({
                subdomain: fullName,
                owner_email: record.owner_email,
                owner_id: record.owner_id,
                record_type: record.record_type,
                content: record.content,
                ttl: record.ttl,
                proxied: record.proxied,
                status: record.status,
                managed: record.managed,
                created: record.created_date,
                last_synced: record.last_synced,
                dns_verified: record.dns_verified,
                request_history: requests.map(r => ({
                    id: r.id,
                    status: r.status,
                    submitted: r.created_date,
                    reviewed_by: r.reviewed_by || null,
                    reviewed_at: r.reviewed_at || null,
                })),
            });
        }
        // GET ?action=rdap&domain=example.com
        if (action === 'rdap') {
            const domain = url.searchParams.get('domain');
            if (!domain)
                return respond({ error: 'domain required' }, 400);
            const rdapRes = await platform.functions.invoke('rdapLookup', { domain });
            return respond(rdapRes.data);
        }
        // GET ?action=records&domain=example.com
        if (action === 'records') {
            const domain = url.searchParams.get('domain');
            if (!domain)
                return respond({ error: 'domain required' }, 400);
            const records = await platform.asServiceRole.entities.DnsRecord.filter({ zone_name: domain });
            return respond({
                records: records.filter(r => r.status !== 'suspended').map(r => ({
                    name: r.name,
                    type: r.record_type,
                    content: r.content,
                    ttl: r.ttl,
                    proxied: r.proxied,
                }))
            });
        }
        // GET ?action=me (authenticated)
        if (action === 'me') {
            const identity = await authorize(req, 'account:read');
            if (identity.error) return respond({ error: identity.error }, identity.status);
            const { user } = identity;
            const [ownedRecords, requests, tokens] = await Promise.all([
                platform.asServiceRole.entities.DnsRecord.filter({ owner_email: user.email }),
                platform.asServiceRole.entities.SubdomainRequest.filter({ requester_email: user.email }),
                platform.asServiceRole.entities.ApiToken.filter({ user_id: user.id, revoked: false }),
            ]);
            return respond({
                id: user.id,
                email: user.email,
                full_name: user.full_name || null,
                role: user.role,
                ns_unlocked: user.ns_unlocked || false,
                joined: user.created_date,
                stats: {
                    active_records: ownedRecords.filter(r => r.status !== 'suspended').length,
                    total_records: ownedRecords.length,
                    total_requests: requests.length,
                    pending_requests: requests.filter(r => r.status === 'pending').length,
                    active_api_tokens: tokens.length,
                },
            });
        }
        return respond({ error: 'Unknown action. Use ?action=check, ?action=whois, ?action=rdap, ?action=records, or ?action=me' }, 400);
    }
    // ── POST actions (require auth) ───────────────────────────────
    if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { action } = body;
        const identity = await authorize(req, action === 'submit' ? 'requests:write' : 'dns:write');
        if (identity.error) return respond({ error: identity.error }, identity.status);
        const { user, token } = identity;
        if (action === 'submit') {
            if (!tokenAllowsRequest(token, body))
                return respond({ error: 'This token is not permitted to request that hostname or record type' }, 403);
            try {
                const result = await invokeInternal('submitRequest', body, { ...user, trusted_source: 'api' });
                const request = result.request || result.requests[0];
                return respond({ ...result, request_id: request.id, status: request.status, safety: { score: request.safety_score ?? 0, verdict: request.safety_verdict || 'incomplete' } });
            } catch (error) {
                return respond({ error: error.message }, error.status || 500);
            }
        }
        if (action === 'update') {
            const { dns_record_id, new_content, new_proxied, new_ttl } = body;
            if (!dns_record_id)
                return respond({ error: 'dns_record_id required' }, 400);
            const records = await platform.asServiceRole.entities.DnsRecord.filter({ id: dns_record_id });
            const record = records[0];
            if (!record)
                return respond({ error: 'DNS record not found' }, 404);
            if (record.owner_email !== user.email && record.owner_id !== user.id)
                return respond({ error: 'Forbidden: you do not own this record' }, 403);
            if (!tokenAllowsRecord(token, record))
                return respond({ error: 'This token is not permitted to modify that hostname or record type' }, 403);
            const changes = {};
            if (new_content !== undefined)
                changes.content = new_content;
            if (new_proxied !== undefined)
                changes.proxied = new_proxied;
            if (new_ttl !== undefined)
                changes.ttl = new_ttl;
            if (!Object.keys(changes).length)
                return respond({ error: 'Provide at least one of: new_content, new_proxied, new_ttl' }, 400);
            try {
                const result = await invokeInternal('manageDnsRecord', {
                    action: 'update',
                    record_id: dns_record_id,
                    ...changes,
                }, user);
                return respond({ success: true, message: 'DNS record updated', record: result?.record || result });
            }
            catch (e) {
                return respond({ error: e?.response?.data?.error || e?.message || 'DNS update failed' }, e?.response?.status || 400);
            }
        }
        return respond({ error: 'Unknown action. Use action: submit or update' }, 400);
    }
    return respond({ error: 'Method not allowed' }, 405);
}
