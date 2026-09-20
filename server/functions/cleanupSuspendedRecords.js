import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { hostnameWithin, normalizeName, reconcileSubdomainOwnerships, sameOwner } from '../lib/subdomain-ownership.js';

const GRACE_DAYS = 7;

export default async function (req) {
  try {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const cutoff = now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000;
    const { stats, ownerships, liveRecords } = await reconcileSubdomainOwnerships(platform, {
      now,
      auditActor: user.email || 'system',
    });

    let deleted = 0;
    let deletionSkippedSafety = 0;
    for (const ownership of ownerships) {
      if (ownership.status !== 'suspended') continue;
      const fullName = normalizeName(ownership.full_name);
      if (!fullName) continue;

      // Never remove ownership while a live managed DNS record exists. The reconciler already
      // performs this check from a complete paginated scan; cleanup repeats it immediately
      // before destructive deletion as a second safety barrier.
      const stillHasRecords = liveRecords.some(record =>
        sameOwner(record, ownership) && hostnameWithin(record.name, fullName));
      if (stillHasRecords) {
        deletionSkippedSafety++;
        continue;
      }

      const suspendedAt = ownership.suspended_at ? new Date(ownership.suspended_at).getTime() : now.getTime();
      if (!Number.isFinite(suspendedAt) || suspendedAt > cutoff) continue;

      await platform.asServiceRole.entities.SubdomainOwnership.delete(ownership.id);
      await platform.asServiceRole.entities.AuditLog.create({
        actor_email: 'system',
        actor_role: 'admin',
        action: 'subdomain_removed_inactive',
        entity_type: 'SubdomainOwnership',
        entity_id: ownership.id,
        description: `Removed ${fullName} from ${ownership.owner_email} after ${GRACE_DAYS} days with no DNS records`,
      });
      deleted++;
    }

    return Response.json({
      success: true,
      grace_days: GRACE_DAYS,
      checked: ownerships.length,
      deleted,
      deletion_safety_skips: deletionSkippedSafety,
      ...stats,
    });
  } catch (error) {
    console.error('cleanupSuspendedRecords failed', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
