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
import { config } from '../config.js';
import { getRequestPolicy, isReservedName } from '../lib/request-policy.js';
import { screenRequest } from '../lib/safety-screening.js';
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/;
async function sha256hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function resolveToken(platform, req) {
    const auth = req.headers.get('Authorization') || '';
    const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!raw)
        return null;
    const hash = await sha256hex(raw);
    const tokens = await platform.asServiceRole.entities.ApiToken.filter({ token_hash: hash });
    const token = tokens.find(item => item.revoked !== true);
    if (!token)
        return null;
    await platform.asServiceRole.entities.ApiToken.update(token.id, { last_used: new Date().toISOString() });
    return token;
}
function validateRecordValue(type, value) {
    if (!value || !value.trim())
        return 'Record value is required';
    const v = value.trim();
    switch (type) {
        case 'A':
            if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(v))
                return 'A record requires a valid IPv4 address';
            if (v.split('.').map(Number).some(p => p > 255))
                return 'IPv4 octets must be 0–255';
            return null;
        case 'AAAA':
            if (!/^[0-9a-fA-F:]+$/.test(v) || !v.includes(':'))
                return 'AAAA requires a valid IPv6 address';
            return null;
        case 'CNAME':
            if (v.includes(' ') || !/^[a-zA-Z0-9._-]+$/.test(v))
                return 'Invalid CNAME target';
            return null;
        case 'MX':
            if (!/^(\d+)\s+(.+)$/.test(v))
                return 'MX format: <priority> <hostname>';
            return null;
        case 'TXT':
            if (v.length > 2048)
                return 'TXT value too long';
            return null;
        case 'NS':
            if (!/^[a-zA-Z0-9._-]+$/.test(v) || !v.includes('.'))
                return 'NS must be a valid FQDN';
            return null;
        default: return null;
    }
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
            const tokenRec = await resolveToken(platform, req);
            if (!tokenRec)
                return respond({ error: 'Unauthorized. Provide a valid API key in Authorization: Bearer <key>' }, 401);
            const userRecords = await platform.asServiceRole.entities.User.filter({ email: tokenRec.user_email });
            const user = userRecords[0];
            if (!user || !['admin', 'staff'].includes(user.role)) {
                return respond({ error: 'Forbidden. This endpoint is restricted to staff and admins.' }, 403);
            }
            const fullName = `${subdomain}.${domain}`;
            const records = await platform.asServiceRole.entities.DnsRecord.filter({ name: fullName });
            if (!records.length)
                return respond({ error: 'Subdomain not found' }, 404);
            const record = records[0];
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
                records: records.map(r => ({
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
            const tokenRec = await resolveToken(platform, req);
            if (!tokenRec)
                return respond({ error: 'Unauthorized. Provide a valid API key in Authorization: Bearer <key>' }, 401);
            const userRecords = await platform.asServiceRole.entities.User.filter({ email: tokenRec.user_email });
            const user = userRecords[0];
            if (!user)
                return respond({ error: 'User not found' }, 401);
            const [ownedRecords, requests, tokens] = await Promise.all([
                platform.asServiceRole.entities.DnsRecord.filter({ owner_email: user.email }),
                platform.asServiceRole.entities.SubdomainRequest.filter({ requester_email: user.email }),
                platform.asServiceRole.entities.ApiToken.filter({ user_id: user.id, revoked: false }),
            ]);
            return respond({
                id: user.id,
                email: user.email,
                display_name: user.display_name || null,
                full_name: user.full_name || null,
                role: user.role,
                ns_unlocked: user.ns_unlocked || false,
                joined: user.created_date,
                stats: {
                    active_records: ownedRecords.filter(r => r.status === 'active').length,
                    total_records: ownedRecords.length,
                    total_requests: requests.length,
                    pending_requests: requests.filter(r => r.status === 'pending').length,
                    active_api_tokens: tokens.length,
                },
            });
        }
        return respond({ error: 'Unknown action. Use ?action=check, ?action=whois, ?action=rdap, ?action=records, or ?action=me' }, 400);
        // whois: GET ?action=whois&subdomain=foo&domain=example.com (staff/admin API key required)
    }
    // ── POST actions (require auth) ───────────────────────────────
    if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { action } = body;
        // Auth required for all POST
        const tokenRec = await resolveToken(platform, req);
        if (!tokenRec)
            return respond({ error: 'Unauthorized. Provide a valid API key in Authorization: Bearer <key>' }, 401);
        const userRecords = await platform.asServiceRole.entities.User.filter({ email: tokenRec.user_email });
        const user = userRecords[0];
        if (!user)
            return respond({ error: 'User not found' }, 401);
        // POST action=submit
        if (action === 'submit') {
            const { subdomain, root_domain, record_type, record_value, ttl, proxied, reason } = body;
            if (!subdomain || !root_domain || !record_type || !record_value) {
                return respond({ error: 'Missing required fields: subdomain, root_domain, record_type, record_value' }, 400);
            }
            const requestPolicy = await getRequestPolicy(platform);
            if (requestPolicy.locked && !['staff', 'admin'].includes(user.role))
                return respond({ error: requestPolicy.message }, 423);
            if (subdomain.length > 63 || !SUBDOMAIN_REGEX.test(subdomain)) {
                return respond({ error: 'Invalid subdomain format' }, 400);
            }
            if (config.donationsEnabled && record_type === 'NS' && !user.ns_unlocked) {
                return respond({ error: 'NS records require a £2+ donation to unlock.' }, 403);
            }
            const valErr = validateRecordValue(record_type, record_value);
            if (valErr)
                return respond({ error: valErr }, 400);
            const domains = await platform.asServiceRole.entities.Domain.filter({ name: root_domain });
            if (!domains.length)
                return respond({ error: 'Domain not found' }, 404);
            const d = domains[0];
            if (!d.allow_new_requests)
                return respond({ error: 'New requests are disabled for this domain' }, 403);
            const reserved = d.reserved_names || [];
            if (isReservedName(subdomain, reserved))
                return respond({ error: 'Subdomain is reserved' }, 409);
            const existing = await platform.asServiceRole.entities.DnsRecord.filter({ name: `${subdomain}.${root_domain}` });
            if (record_type === 'CNAME' && existing.length > 0)
                return respond({ error: 'Cannot add CNAME: records already exist' }, 409);
            if (existing.some(r => r.record_type === 'CNAME'))
                return respond({ error: 'A CNAME already exists for this hostname' }, 409);
            if (existing.find(r => r.record_type === record_type && r.content === record_value.trim())) {
                return respond({ error: 'This exact record already exists' }, 409);
            }
            const hostnameTypes = ['NS', 'CNAME', 'MX'];
            const normalisedValue = hostnameTypes.includes(record_type)
                ? record_value.trim().replace(/\.$/, '') : record_value.trim();
            const request = await platform.asServiceRole.entities.SubdomainRequest.create({
                requester_email: user.email, requester_id: user.id,
                subdomain, root_domain, full_name: `${subdomain}.${root_domain}`,
                record_type, record_value: normalisedValue, ttl: ttl || 3600,
                proxied: record_type === 'NS' ? false : (proxied || false),
                reason: reason || '', preview_link: body.preview_link || '', status: 'pending', zone_id: d.zone_id
            });
            let assessment;
            try {
                assessment = await screenRequest(platform, request, user, 'legacy_api');
            }
            catch (_) {
                await platform.asServiceRole.entities.SubdomainRequest.update(request.id, {
                    safety_score: 0, safety_verdict: 'incomplete', safety_screened_at: new Date().toISOString()
                }).catch(() => {});
            }
            return respond({ success: true, request_id: request.id, status: 'pending', safety: assessment ? { score: assessment.score, verdict: assessment.verdict } : { score: 0, verdict: 'incomplete' } });
        }
        // POST action=update — direct DNS mutation.
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
                const result = await platform.asServiceRole.functions.invoke('manageDnsRecord', {
                    action: 'update',
                    record_id: dns_record_id,
                    base_name: record.name,
                    api_token_id: tokenRec.id,
                    ...changes,
                });
                return respond({ success: true, message: 'DNS record updated', record: result?.data?.record || result?.data || result });
            }
            catch (e) {
                return respond({ error: e?.response?.data?.error || e?.message || 'DNS update failed' }, e?.response?.status || 400);
            }
        }
        return respond({ error: 'Unknown action. Use action: submit or update' }, 400);
    }
    return respond({ error: 'Method not allowed' }, 405);
}
