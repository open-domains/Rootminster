import { createPlatformClientFromRequest } from '../lib/platform-client.js';
const DOH_URL = 'https://cloudflare-dns.com/dns-query';
const TYPE_NUMBERS = {
    A: 1,
    NS: 2,
    CNAME: 5,
    PTR: 12,
    MX: 15,
    TXT: 16,
    AAAA: 28,
    SRV: 33,
    CAA: 257,
};
const BATCH_SIZE = 10;
function normalise(value) {
    return String(value ?? '').replace(/\.$/, '').toLowerCase().trim();
}
function cleanTxt(value) {
    return normalise(value).replace(/^"|"$/g, '').replace(/"\s+"/g, '');
}
async function queryDns(name, type) {
    const url = `${DOH_URL}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
    const response = await fetch(url, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        throw new Error(`DNS-over-HTTPS returned HTTP ${response.status}`);
    }
    return response.json();
}
async function verifyRecord(record) {
    const type = String(record.record_type || '').toUpperCase();
    const typeNumber = TYPE_NUMBERS[type];
    if (!typeNumber) {
        return { verified: false, reason: `Unsupported DNS record type: ${type}` };
    }
    // Cloudflare replaces proxied A/AAAA/CNAME answers with edge addresses.
    // Confirm that the hostname resolves, without comparing the hidden origin value.
    if (record.proxied && ['A', 'AAAA', 'CNAME'].includes(type)) {
        const data = await queryDns(record.name, 'A');
        const hasAddress = data?.Status === 0 && (data.Answer || []).some((answer) => answer.type === 1 || answer.type === 28);
        return hasAddress
            ? { verified: true, reason: null }
            : { verified: false, reason: 'Proxied hostname does not currently resolve to a Cloudflare edge address' };
    }
    // Flattened CNAMEs intentionally answer with the target's final A/AAAA records.
    if (type === 'CNAME' && record.cname_flatten) {
        const [ipv4, ipv6] = await Promise.all([
            queryDns(record.name, 'A'),
            queryDns(record.name, 'AAAA'),
        ]);
        const hasAddress = [ipv4, ipv6].some(data => data?.Status === 0 && (data.Answer || []).some((answer) => answer.type === 1 || answer.type === 28));
        return hasAddress
            ? { verified: true, reason: null }
            : { verified: false, reason: 'Flattened CNAME does not currently resolve to an A or AAAA address' };
    }
    const data = await queryDns(record.name, type);
    if (!data || data.Status !== 0) {
        return {
            verified: false,
            reason: `DNS query failed or returned NXDOMAIN (status: ${data?.Status ?? 'unknown'})`,
        };
    }
    const answers = (data.Answer || []).filter((answer) => answer.type === typeNumber);
    if (!answers.length) {
        return { verified: false, reason: `No ${type} record was found in public DNS` };
    }
    const found = answers.map((answer) => normalise(answer.data));
    const expected = normalise(record.content);
    if (type === 'TXT') {
        const expectedTxt = cleanTxt(record.content);
        const foundTxt = answers.map((answer) => cleanTxt(answer.data));
        return foundTxt.includes(expectedTxt)
            ? { verified: true, reason: null }
            : { verified: false, reason: `TXT mismatch. Expected "${expectedTxt}". Found: ${foundTxt.map((v) => `"${v}"`).join(', ')}` };
    }
    if (type === 'MX') {
        const expectedHost = normalise(String(record.content || '').replace(/^\d+\s+/, ''));
        const foundHosts = found.map((value) => normalise(value.replace(/^\d+\s+/, '')));
        return foundHosts.includes(expectedHost)
            ? { verified: true, reason: null }
            : { verified: false, reason: `MX mismatch. Expected "${expectedHost}". Found: ${found.join(', ')}` };
    }
    return found.includes(expected)
        ? { verified: true, reason: null }
        : { verified: false, reason: `${type} mismatch. Expected "${expected}". Found: ${found.join(', ')}` };
}
export default async function (req) {
    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
    }
    try {
        const platform = createPlatformClientFromRequest(req);
        const payload = await req.json().catch(() => ({}));
        const isScheduledWorkflow = payload?.source === 'scheduled_workflow';
        const user = await platform.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (user.role !== 'admin') {
            return Response.json({ error: 'Only an administrator can run a full DNS check' }, { status: 403 });
        }
        // Manual admin checks and the scheduled workflow both run the same full scan.
        const records = await platform.asServiceRole.entities.DnsRecord.filter({
            managed: true,
            status: 'active',
        });
        const checkedAt = new Date().toISOString();
        const results = [];
        for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
            const batch = records.slice(offset, offset + BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(async (record) => {
                let result;
                try {
                    result = await verifyRecord(record);
                }
                catch (error) {
                    result = {
                        verified: false,
                        reason: `Verification error: ${error?.message || 'Unknown error'}`,
                    };
                }
                await platform.asServiceRole.entities.DnsRecord.update(record.id, {
                    dns_verified: result.verified,
                    dns_last_checked: checkedAt,
                    dns_mismatch_reason: result.reason,
                });
                return {
                    id: record.id,
                    name: record.name,
                    record_type: record.record_type,
                    verified: result.verified,
                    reason: result.reason,
                };
            }));
            results.push(...batchResults);
        }
        const verified = results.filter(result => result.verified).length;
        const failed = results.length - verified;
        await platform.asServiceRole.entities.AuditLog.create({
            actor_email: user.email,
            actor_role: user.role,
            action: isScheduledWorkflow ? 'scheduled_dns_check_completed' : 'manual_dns_check_completed',
            entity_type: 'DnsRecord',
            description: `${isScheduledWorkflow ? 'Scheduled' : 'Manual'} full DNS check completed: ${verified} verified, ${failed} failed, ${results.length} checked`,
            new_value: JSON.stringify({ source: isScheduledWorkflow ? 'workflow' : 'manual', checked_at: checkedAt, checked: results.length, verified, failed }),
        });
        return Response.json({
            success: true,
            checked_at: checkedAt,
            checked: results.length,
            verified,
            failed,
            results,
        });
    }
    catch (error) {
        return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
    }
}
