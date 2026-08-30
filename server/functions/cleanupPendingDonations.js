/**
 * cleanupPendingDonations — Deletes Donation records that have been stuck
 * in "pending" status for more than 48 hours.
 * Runs on a schedule; no user auth required.
 */
import { createPlatformClientFromRequest } from '../lib/platform-client.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const cutoff = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago
    const all = await platform.asServiceRole.entities.Donation.list();
    const stale = all.filter(d => d.status === 'pending' &&
        new Date(d.created_date).getTime() < cutoff);
    if (!stale.length) {
        return Response.json({ deleted: 0, message: 'No stale pending donations found.' });
    }
    await Promise.all(stale.map(d => platform.asServiceRole.entities.Donation.delete(d.id)));
    return Response.json({ deleted: stale.length, message: `Deleted ${stale.length} stale pending donation(s).` });
}
