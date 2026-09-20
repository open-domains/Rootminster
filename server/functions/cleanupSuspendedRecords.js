import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { normalizeName, reconcileSubdomainOwnerships, syncOwnershipForNamespace } from '../lib/subdomain-ownership.js';

const GRACE_DAYS = 7;

export default async function (req) {
  try {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const now = new Date();
    const cutoff = now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000;
    const { stats, ownerships } = await reconcileSubdomainOwnerships(platform, {
      now,
      auditActor: user.email || 'system',
    });

    let deleted = 0;
    let deletionSkippedSafety = 0;
    for (const ownership of ownerships) {
      if (ownership.status !== 'suspended') continue;
      const fullName = normalizeName(ownership.full_name);
      if (!fullName) continue;

      // Re-derive state immediately before destructive deletion. This second check understands
      // approved request-to-record links as well as normal hostname containment, so special
      // records such as GitHub Pages verification TXT records also protect their ownership.
      const safetyState = await syncOwnershipForNamespace(platform, {
        owner: { id: ownership.owner_id, email: ownership.owner_email },
        fullName,
        zone: { name: ownership.root_domain, zone_id: ownership.zone_id },
        now,
      });
      if (safetyState.status === 'active') {
        deletionSkippedSafety++;
        continue;
      }

      const suspendedAt = safetyState.ownership?.suspended_at
        ? new Date(safetyState.ownership.suspended_at).getTime()
        : now.getTime();
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
