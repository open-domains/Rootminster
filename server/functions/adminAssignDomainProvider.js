import { createPlatformClientFromRequest } from '../lib/platform-client.js';

/**
 * Assigns or removes a domain provider for a given domain.
 * Admin-only. Body shape:
 *   { domain_id: string, user_id: string | null }
 *
 * Setting user_id to null unassigns the current provider.
 * The target user must have role='domain_provider'.
 */
export default async function (req) {
  const platform = createPlatformClientFromRequest(req);
  const actor = await platform.auth.me();
  if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (actor.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = req.method === 'POST' ? await req.json() : {};
  const { domain_id, user_id } = body;
  if (!domain_id) return Response.json({ error: 'domain_id is required' }, { status: 400 });

  const domain = await platform.asServiceRole.entities.Domain.get(domain_id);
  if (!domain) return Response.json({ error: 'Domain not found' }, { status: 404 });

  // Assigning a provider: validate the target user exists and has the domain_provider role
  if (user_id) {
    const targetUser = await platform.asServiceRole.entities.User.get(user_id);
    if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });
    if (targetUser.role !== 'domain_provider') {
      return Response.json(
        { error: `User must have role 'domain_provider' before being assigned a domain. Current role: ${targetUser.role}` },
        { status: 422 },
      );
    }

    const updated = await platform.asServiceRole.entities.Domain.update(domain_id, {
      provider_user_id: targetUser.id,
      provider_user_email: targetUser.email,
      provider_assigned_at: new Date().toISOString(),
    });

    await platform.asServiceRole.entities.AuditLog.create({
      actor_email: actor.email,
      actor_role: actor.role,
      action: 'domain_provider_assigned',
      entity_type: 'Domain',
      entity_id: domain_id,
      description: `Domain provider for ${domain.name} assigned to ${targetUser.email}`,
    });

    return Response.json({ success: true, domain: updated });
  }

  // Unassigning: clear provider fields
  const updated = await platform.asServiceRole.entities.Domain.update(domain_id, {
    provider_user_id: null,
    provider_user_email: null,
    provider_assigned_at: null,
  });

  await platform.asServiceRole.entities.AuditLog.create({
    actor_email: actor.email,
    actor_role: actor.role,
    action: 'domain_provider_unassigned',
    entity_type: 'Domain',
    entity_id: domain_id,
    description: `Domain provider for ${domain.name} removed`,
  });

  return Response.json({ success: true, domain: updated });
}
