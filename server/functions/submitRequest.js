import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { getModuleConfig } from '../module-settings.js';
import { getRequestPolicy, isReservedName } from '../lib/request-policy.js';
import { screenRequest } from '../lib/safety-screening.js';
const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9\-_\.~]*$|^[a-z0-9]$/;
const HOSTNAME_TYPES = ['NS', 'CNAME', 'MX'];
const SINGLE_VALUE_TYPES = ['CNAME'];
function validateRecordValue(type, value) {
    if (!value || !value.trim())
        return 'Record value is required';
    const v = value.trim();
    switch (type) {
        case 'A': {
            if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(v))
                return 'A record requires a valid IPv4 address';
            if (v.split('.').map(Number).some(p => p > 255))
                return 'IPv4 octets must be 0–255';
            return null;
        }
        case 'AAAA': {
            if (!/^[0-9a-fA-F:]+$/.test(v) || !v.includes(':'))
                return 'AAAA requires a valid IPv6 address';
            return null;
        }
        case 'CNAME': {
            if (v.includes(' ') || !/^[a-zA-Z0-9._-]+$/.test(v))
                return 'Invalid CNAME target';
            if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v))
                return 'CNAME target must be a hostname, not an IP address';
            if (/^[0-9a-fA-F:]+$/.test(v) && v.includes(':'))
                return 'CNAME target must be a hostname, not an IP address';
            if (/(^|\.)ns\d*\./.test(v.toLowerCase()) || /^ns\d*\./i.test(v))
                return 'CNAME cannot point to a nameserver (ns) hostname';
            return null;
        }
        case 'MX': {
            // Accept either "10 mail.example.com" or just "mail.example.com" (priority auto-assigned)
            if (!/^(\d+\s+)?.+$/.test(v) || v.trim() === '')
                return 'MX requires a valid hostname';
            return null;
        }
        case 'TXT': {
            if (v.length > 2048)
                return 'TXT value too long';
            const alphanumCount = (v.match(/[a-zA-Z0-9]/g) || []).length;
            if (alphanumCount < 6)
                return 'TXT record must contain at least 6 letters or numbers';
            return null;
        }
        case 'NS': {
            if (!/^[a-zA-Z0-9._-]+$/.test(v) || !v.includes('.'))
                return 'NS must be a valid FQDN';
            return null;
        }
        default: return null;
    }
}
const PRIVATE_RANGES = [
    /^127\./, // 127.0.0.0/8 loopback
    /^10\./, // 10.0.0.0/8 private
    /^192\.168\./, // 192.168.0.0/16 private
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 private
    /^169\.254\./, // 169.254.0.0/16 link-local
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 CGNAT
    /^0\./, // 0.0.0.0/8
    /^::1$/, // IPv6 loopback
    /^fe80:/i, // IPv6 link-local
    /^fc00:/i, // IPv6 unique local
    /^fd[0-9a-f]{2}:/i, // IPv6 unique local
];
function normaliseValue(record_type, record_value) {
    let v = HOSTNAME_TYPES.includes(record_type)
        ? record_value.trim().replace(/\.$/, '')
        : record_value.trim();
    if (record_type === 'MX' && !/^\d+\s+/.test(v))
        v = `10 ${v}`;
    return v;
}
async function sendDiscord(platform, fields, title, color) {
    try {
        const settings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_webhook_url' });
        const webhookUrl = settings?.[0]?.value;
        if (!webhookUrl)
            return;
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                        title, color,
                        fields: fields.map(f => ({ name: f.name, value: String(f.value || '—'), inline: true })),
                        timestamp: new Date().toISOString(),
                        footer: { text: 'Open Domains Platform' }
                    }]
            })
        });
    }
    catch (_) { }
}
export default async function (req) {
    const [turnstile, donations] = await Promise.all([getModuleConfig('turnstile'), getModuleConfig('donations')]);
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const trustedClient = ['api', 'discord'].includes(user.trusted_source);
    const { subdomain, root_domain, reason, preview_link, recaptcha_token } = body;
    const requestPolicy = await getRequestPolicy(platform);
    if (requestPolicy.locked && !['staff', 'admin'].includes(user.role)) {
        return Response.json({ error: requestPolicy.message }, { status: 423 });
    }
    // Build the record list. Supports a `records` array (batch submission) and
    // falls back to legacy single-record fields for backward compatibility.
    let recordList;
    if (Array.isArray(body.records) && body.records.length > 0) {
        recordList = body.records.map(r => ({
            record_type: r.record_type,
            record_value: r.record_value,
            ttl: r.ttl || 3600,
            proxied: r.proxied || false,
        }));
    }
    else {
        recordList = [{
                record_type: body.record_type,
                record_value: body.record_value,
                ttl: body.ttl || 3600,
                proxied: body.proxied || false,
            }];
    }
    if (!subdomain || !root_domain) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!recordList.every(r => r.record_type && r.record_value)) {
        return Response.json({ error: 'Missing record type or value' }, { status: 400 });
    }
    if (!preview_link || !preview_link.trim()) {
        return Response.json({ error: 'A preview link is required' }, { status: 400 });
    }
    // Turnstile — verified ONCE for the whole batch (tokens are single-use)
    if (turnstile.enabled && turnstile.secret_key && !trustedClient && !recaptcha_token) {
        return Response.json({ error: 'Please complete the CAPTCHA' }, { status: 400 });
    }
    if (turnstile.enabled && turnstile.secret_key && !trustedClient) {
        const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ secret: turnstile.secret_key, response: recaptcha_token })
        });
        const turnstileData = await turnstileRes.json();
        if (!turnstileData.success) {
            return Response.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 400 });
        }
    }
    // Subdomain format
    if (subdomain.length > 63 || !SUBDOMAIN_REGEX.test(subdomain)) {
        return Response.json({ error: 'Invalid subdomain format' }, { status: 400 });
    }
    // NS records require donation unlock (if any record in the batch is NS)
    if (donations.enabled && recordList.some(r => r.record_type === 'NS')) {
        const userRecord = await platform.asServiceRole.entities.User.filter({ email: user.email });
        if (!userRecord?.[0]?.ns_unlocked) {
            return Response.json({ error: 'NS records require a £2+ donation to unlock. See Settings.' }, { status: 403 });
        }
    }
    // Per-record value validation
    for (const r of recordList) {
        const valueError = validateRecordValue(r.record_type, r.record_value);
        if (valueError)
            return Response.json({ error: valueError }, { status: 400 });
    }
    // Private/loopback IP check (A / AAAA)
    for (const r of recordList) {
        if (['A', 'AAAA'].includes(r.record_type)) {
            const normVal = r.record_value.trim().toLowerCase();
            const privateMatch = PRIVATE_RANGES.find(rx => rx.test(normVal));
            if (privateMatch) {
                return Response.json({ error: 'Private, loopback, and link-local IP addresses are not permitted' }, { status: 403 });
            }
        }
    }
    // Blocklist check (exact + regex, per record)
    const blocklist = await platform.asServiceRole.entities.BlocklistEntry.list();
    for (const r of recordList) {
        const normVal = r.record_value.trim().toLowerCase();
        const blocked = blocklist.find(b => {
            const typeMatch = !b.record_type || b.record_type === 'ANY' || b.record_type === r.record_type;
            if (!typeMatch)
                return false;
            if (b.is_regex) {
                try {
                    return new RegExp(b.value, 'i').test(normVal);
                }
                catch (_) {
                    return false;
                }
            }
            return b.value.toLowerCase() === normVal;
        });
        if (blocked) {
            const blockedReason = blocked.reason ? `: ${blocked.reason}` : '';
            return Response.json({ error: `This record value is not permitted${blockedReason}` }, { status: 403 });
        }
    }
    // Domain check
    const domain = await platform.asServiceRole.entities.Domain.filter({ name: root_domain });
    if (!domain.length)
        return Response.json({ error: 'Domain not found' }, { status: 404 });
    const d = domain[0];
    if (!d.allow_new_requests)
        return Response.json({ error: 'New requests are disabled for this domain' }, { status: 403 });
    // Reserved names
    const reserved = d.reserved_names || [];
    if (isReservedName(subdomain, reserved)) {
        return Response.json({ error: 'This subdomain name is reserved' }, { status: 409 });
    }
    // Existing DNS records for this hostname
    const existing = await platform.asServiceRole.entities.DnsRecord.filter({ name: `${subdomain}.${root_domain}` });
    const existingTypes = existing.map(r => r.record_type);
    // CNAME cannot coexist with any other record (existing or in the batch)
    const batchHasCname = recordList.some(r => r.record_type === 'CNAME');
    if (batchHasCname && (existing.length > 0 || recordList.length > 1)) {
        return Response.json({ error: 'Cannot add CNAME: other records already exist for this hostname' }, { status: 409 });
    }
    if (existingTypes.includes('CNAME') && recordList.length > 0) {
        return Response.json({ error: 'Cannot add record: a CNAME already exists for this hostname' }, { status: 409 });
    }
    // Single-value types (e.g. CNAME): only one allowed per hostname
    for (const svType of SINGLE_VALUE_TYPES) {
        const batchCount = recordList.filter(r => r.record_type === svType).length;
        const existingCount = existing.filter(r => r.record_type === svType).length;
        if (batchCount + existingCount > 1) {
            return Response.json({ error: `Only one ${svType} record is allowed per hostname` }, { status: 409 });
        }
    }
    // Exact duplicate check — within the batch and against existing records
    const seen = new Set();
    for (const r of recordList) {
        const norm = normaliseValue(r.record_type, r.record_value);
        const key = `${r.record_type}|${norm.toLowerCase()}`;
        if (seen.has(key)) {
            return Response.json({ error: 'Duplicate record in submission' }, { status: 409 });
        }
        seen.add(key);
        const exactDup = existing.find(e => e.record_type === r.record_type && e.content === norm);
        if (exactDup) {
            return Response.json({ error: 'This exact record already exists' }, { status: 409 });
        }
    }
    // Pending requests check
    const pending = await platform.asServiceRole.entities.SubdomainRequest.filter({
        subdomain, root_domain, status: 'pending'
    });
    if (pending.length > 0) {
        for (const r of recordList) {
            const norm = normaliseValue(r.record_type, r.record_value);
            const isDup = pending.find(p => p.record_type === r.record_type && p.record_value === norm);
            if (isDup) {
                return Response.json({ error: 'A pending request for this exact record already exists' }, { status: 409 });
            }
        }
    }
    // Create all SubdomainRequest records
    const created = [];
    for (const r of recordList) {
        const normalisedValue = normaliseValue(r.record_type, r.record_value);
        const request = await platform.asServiceRole.entities.SubdomainRequest.create({
            requester_email: user.email, requester_id: user.id,
            subdomain, root_domain, full_name: `${subdomain}.${root_domain}`,
            record_type: r.record_type, record_value: normalisedValue, ttl: r.ttl || 3600,
            proxied: r.record_type === 'NS' ? false : (r.proxied || false),
            reason: reason || '', preview_link: preview_link.trim(), status: 'pending', zone_id: d.zone_id
        });
        created.push(request);
    }
    const typeList = recordList.map(r => r.record_type);
    const valueList = recordList.map(r => r.record_value);
    const screened = [];
    for (const request of created) {
        try {
            const assessment = await screenRequest(platform, request, user);
            Object.assign(request, {
                safety_assessment_id: assessment.id,
                safety_score: assessment.score,
                safety_verdict: assessment.verdict,
                safety_screened_at: assessment.screened_at,
                safety_ruleset_version: assessment.ruleset_version,
            });
            screened.push(assessment);
        }
        catch (_) {
            await platform.asServiceRole.entities.SubdomainRequest.update(request.id, {
                safety_score: 0,
                safety_verdict: 'incomplete',
                safety_screened_at: new Date().toISOString(),
            }).catch(() => {});
            request.safety_score = 0;
            request.safety_verdict = 'incomplete';
        }
    }
    const highestRisk = screened.sort((a, b) => Number(b.score) - Number(a.score))[0];
    // Discord notification
    await sendDiscord(platform, [
        { name: 'Subdomain', value: String(subdomain + '.' + root_domain) },
        { name: 'Types', value: typeList.join(', ') },
        { name: 'Values', value: valueList.join(', ') },
        { name: 'Requested By', value: String(user.email) },
        { name: 'Status', value: 'Pending Review' },
        { name: 'Safety', value: highestRisk ? `${highestRisk.verdict} (${highestRisk.score}/100)` : 'Screening incomplete' }
    ], 'New Subdomain Request', 0x6366f1);
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: user.email, actor_role: user.role || 'user',
        action: 'request_submitted', entity_type: 'SubdomainRequest', entity_id: created[0].id,
        description: `New subdomain request: ${subdomain}.${root_domain} (${typeList.join(', ')})`
    });
    return Response.json({ success: true, requests: created });
}
