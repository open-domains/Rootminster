import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { normalizeName } from '../lib/subdomain-ownership.js';
import { hiddenReason, openReportHostSet, publicListing } from '../lib/showcase.js';

// Public: approved showcase listings that are currently safe to show.
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const entities = platform.asServiceRole.entities;
        const entries = await entities.ShowcaseEntry.filter({ status: 'approved' }, '-approved_at', 1000);
        if (!entries.length) return Response.json({ listings: [] }, { headers: { 'Cache-Control': 'public, max-age=300' } });
        const hosts = entries.map((entry) => entry.hostname);
        const [ownerships, reports] = await Promise.all([
            entities.SubdomainOwnership.filter({ full_name: { $in: hosts } }, 'full_name', 5000),
            entities.AbuseReport.filter({ normalized_host: { $in: hosts } }, '-created_date', 5000),
        ]);
        const openReportHosts = openReportHostSet(reports);
        const visible = entries.filter((entry) => {
            const ownership = ownerships.find((row) => normalizeName(row.full_name) === entry.hostname && row.owner_id === entry.owner_id);
            return !hiddenReason(entry, { ownership, openReportHosts });
        });
        const ownerIds = [...new Set(visible.filter((entry) => entry.show_owner).map((entry) => entry.owner_id))];
        const owners = ownerIds.length ? await entities.User.filter({ id: { $in: ownerIds } }) : [];
        const listings = visible.map((entry) => publicListing(entry, owners.find((owner) => owner.id === entry.owner_id)));
        return Response.json({ listings }, { headers: { 'Cache-Control': 'public, max-age=300' } });
    }
    catch {
        return Response.json({ error: 'Could not load the showcase.' }, { status: 500 });
    }
}
