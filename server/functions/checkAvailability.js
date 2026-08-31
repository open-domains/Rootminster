import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { getRequestPolicy, isReservedName } from '../lib/request-policy.js';
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$|^[a-z0-9]$/;
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { subdomain, root_domain } = body;
    if (!subdomain || !root_domain) {
        return Response.json({ status: 'invalid', message: 'Subdomain and root domain required' });
    }
    const requestPolicy = await getRequestPolicy(platform);
    if (requestPolicy.locked && !['staff', 'admin'].includes(user.role)) {
        return Response.json({ status: 'locked', message: requestPolicy.message });
    }
    // Format validation
    if (subdomain.length > 63) {
        return Response.json({ status: 'invalid', message: 'Subdomain must be 63 characters or fewer' });
    }
    if (!SUBDOMAIN_REGEX.test(subdomain)) {
        return Response.json({ status: 'invalid', message: 'Only lowercase letters, numbers, and hyphens allowed. Cannot start or end with a hyphen.' });
    }
    const fullName = `${subdomain}.${root_domain}`;
    // Check domain exists and allows requests
    const domains = await platform.asServiceRole.entities.Domain.filter({ name: root_domain });
    if (!domains.length) {
        return Response.json({ status: 'invalid', message: 'Domain not found' });
    }
    const domain = domains[0];
    if (!domain.allow_new_requests) {
        return Response.json({ status: 'locked', message: 'New requests are disabled for this domain' });
    }
    // Check reserved names
    const reserved = domain.reserved_names || [];
    if (isReservedName(subdomain, reserved)) {
        return Response.json({ status: 'reserved', message: 'This subdomain name is reserved' });
    }
    // Ownership persists even when the subdomain temporarily has zero DNS records.
    const ownership = await platform.asServiceRole.entities.SubdomainOwnership.filter({ full_name: fullName.toLowerCase() });
    if (ownership.length > 0) {
        const isOwn = ownership[0].owner_id === user.id || ownership[0].owner_email === user.email;
        return Response.json({ status: isOwn ? 'owned' : 'taken', message: isOwn ? 'You already own this subdomain' : 'This subdomain is already in use' });
    }
    // Check existing DNS records (legacy fallback before ownership backfill).
    const existing = await platform.asServiceRole.entities.DnsRecord.filter({ name: fullName });
    if (existing.length > 0) {
        const owner = existing[0].owner_email;
        if (owner === user.email) {
            return Response.json({ status: 'owned', message: 'You already own this subdomain' });
        }
        return Response.json({ status: 'taken', message: 'This subdomain is already in use' });
    }
    // Check pending requests
    const pending = await platform.asServiceRole.entities.SubdomainRequest.filter({
        subdomain, root_domain, status: 'pending'
    });
    if (pending.length > 0) {
        const isOwn = pending[0].requester_email === user.email;
        return Response.json({
            status: 'pending',
            message: isOwn ? 'You already have a pending request for this subdomain' : 'This subdomain has a pending approval request'
        });
    }
    // Check approved requests not yet synced
    const approved = await platform.asServiceRole.entities.SubdomainRequest.filter({
        subdomain, root_domain, status: 'approved'
    });
    if (approved.length > 0) {
        return Response.json({ status: 'taken', message: 'This subdomain has been approved and will be active soon' });
    }
    return Response.json({ status: 'available', message: 'This subdomain is available!' });
}
