import { createPlatformClientFromRequest } from '../lib/platform-client.js';
// Compatibility wrapper for older API clients. New code should call
// manageDnsRecord directly. Keeping this wrapper avoids breaking old links while
// ensuring nested records use exactly the same validation and ownership rules.
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me();
        if (!user)
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const { parent_record_id, nested_label, record_type, record_value, ttl, proxied, cname_flatten } = body;
        if (!parent_record_id || !nested_label || !record_type || record_value === undefined) {
            return Response.json({ error: 'parent_record_id, nested_label, record_type and record_value are required' }, { status: 400 });
        }
        const parents = await platform.asServiceRole.entities.DnsRecord.filter({ id: parent_record_id });
        if (!parents.length)
            return Response.json({ error: 'Parent record not found' }, { status: 404 });
        const parent = parents[0];
        if (user.role !== 'admin' && user.role !== 'staff' && parent.owner_id !== user.id && parent.owner_email !== user.email) {
            return Response.json({ error: 'Forbidden: you do not own this domain' }, { status: 403 });
        }
        const label = String(nested_label).trim().toLowerCase().replace(/^\.+|\.+$/g, '');
        if (!label || label.split('.').some((part) => !part || (part !== '*' && !/^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/.test(part)))) {
            return Response.json({ error: 'Invalid nested subdomain name' }, { status: 400 });
        }
        const name = `${label}.${String(parent.name).toLowerCase()}`;
        const result = await platform.functions.invoke('manageDnsRecord', {
            action: 'create',
            name,
            base_name: parent.name,
            record_type,
            content: String(record_value).trim(),
            ttl: ttl || 3600,
            proxied: !!proxied,
            cname_flatten: cname_flatten === true,
            owner_email: parent.owner_email || user.email,
        });
        return Response.json({ success: true, dns_record: result?.data?.record || result?.data || result });
    }
    catch (error) {
        return Response.json({ error: error?.response?.data?.error || error?.message || 'Could not create nested DNS record' }, { status: error?.response?.status || 400 });
    }
}
