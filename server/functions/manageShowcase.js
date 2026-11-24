import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { normalizeName } from '../lib/subdomain-ownership.js';
import { hiddenReason, openReportHostSet, validateListing } from '../lib/showcase.js';

function ownerView(entry, reason) {
    if (!entry) return null;
    return {
        id: entry.id, hostname: entry.hostname, title: entry.title, description: entry.description, tags: entry.tags || [],
        show_owner: Boolean(entry.show_owner), status: entry.status, review_note: entry.status === 'rejected' ? entry.review_note || '' : '',
        visible: entry.status === 'approved' && !reason, hidden_reason: entry.status === 'approved' ? reason : null,
    };
}

// Owners: read, submit, or remove the showcase listing for one of their subdomains.
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me().catch(() => null);
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const hostname = normalizeName(body.hostname);
        const action = String(body.action || 'get');
        const entities = platform.asServiceRole.entities;
        const ownership = (await entities.SubdomainOwnership.filter({ owner_id: user.id, full_name: hostname }))[0];
        if (!hostname || !ownership) return Response.json({ error: 'You do not own this subdomain.' }, { status: 403 });
        const existing = (await entities.ShowcaseEntry.filter({ hostname }))[0] || null;
        if (existing && existing.owner_id !== user.id) {
            // The subdomain changed hands; the old owner's listing does not carry over.
            await entities.ShowcaseEntry.delete(existing.id);
        }
        const entry = existing && existing.owner_id === user.id ? existing : null;

        if (action === 'get') {
            const reports = entry ? await entities.AbuseReport.filter({ normalized_host: hostname }) : [];
            return Response.json({ listing: ownerView(entry, entry ? hiddenReason(entry, { ownership, openReportHosts: openReportHostSet(reports) }) : null) });
        }
        if (action === 'remove') {
            if (entry) await entities.ShowcaseEntry.delete(entry.id);
            return Response.json({ listing: null });
        }
        if (action !== 'save') return Response.json({ error: 'Unknown action' }, { status: 400 });
        if (ownership.status === 'suspended') return Response.json({ error: 'Suspended subdomains cannot be listed.' }, { status: 409 });
        const { listing, error } = validateListing(body);
        if (error) return Response.json({ error }, { status: 400 });
        const now = new Date().toISOString();
        const contentChanged = !entry || entry.title !== listing.title || entry.description !== listing.description
            || JSON.stringify(entry.tags || []) !== JSON.stringify(listing.tags);
        // Changing what the listing says sends it back to staff; only the owner-name toggle
        // can change without another review.
        const fields = {
            ...listing,
            hostname,
            owner_id: user.id,
            owner_email: user.email,
            ...(contentChanged ? { status: 'pending', submitted_at: now, review_note: '' } : {}),
        };
        const saved = entry ? await entities.ShowcaseEntry.update(entry.id, fields) : await entities.ShowcaseEntry.create(fields);
        return Response.json({ listing: ownerView(saved, null) });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
