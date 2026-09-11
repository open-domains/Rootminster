import { authenticateRequest, createSession } from './auth.js';
import { config } from './config.js';
import { pool } from './database.js';
import { store } from './store.js';

async function audit(actor, action, target, reason, request, sessionId) {
  await store.create('AuditLog', {
    actor_id: actor.id,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    entity_type: 'User',
    entity_id: target.id,
    target_user_id: target.id,
    target_user_email: target.email,
    reason,
    impersonation_session_id: sessionId,
    ip_address: request.ip,
    user_agent: request.headers['user-agent'] || null,
    description: `${actor.email} ${action === 'impersonation_started' ? 'started viewing as' : 'stopped viewing as'} ${target.email}: ${reason}`,
  }, actor);
}

export async function registerImpersonationRoutes(app) {
  app.addHook('preHandler', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
    const path = request.url.split('?')[0];
    if (path === '/api/admin/impersonation/start' || path === '/api/auth/impersonation/stop') return;
    const user = await authenticateRequest(request, { allowMfaPending: true });
    if (!user?.impersonation?.active) return;
    request.impersonatedRequest = user;
    const securitySensitive = [
      '/api/auth/passkeys', '/api/auth/tokens', '/api/functions/twoFactorAuth',
      '/functions/twoFactorAuth', '/api/account-deletion-request',
    ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    if (securitySensitive || (path === '/api/auth/me' && request.method === 'PATCH')) {
      return reply.code(403).send({ error: 'This security-sensitive action is unavailable during a view-as session' });
    }
  });

  app.addHook('onResponse', async (request, reply) => {
    const target = request.impersonatedRequest;
    if (!target) return;
    const actor = { id: target.impersonation.actor_id, email: target.impersonation.actor_email, role: 'admin' };
    await store.create('AuditLog', {
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role,
      action: 'impersonated_request',
      entity_type: 'User',
      entity_id: target.id,
      target_user_id: target.id,
      target_user_email: target.email,
      reason: target.impersonation.reason,
      method: request.method,
      route: request.routeOptions?.url || request.url.split('?')[0],
      response_status: reply.statusCode,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] || null,
      description: `${actor.email} performed ${request.method} ${request.url.split('?')[0]} while viewing as ${target.email} (${reply.statusCode})`,
    }, actor);
  });

  app.post('/api/admin/impersonation/start', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const actor = await authenticateRequest(request);
    if (!actor) return reply.code(401).send({ error: 'Unauthorized' });
    if (actor.role !== 'admin' || actor.impersonation?.active) return reply.code(403).send({ error: 'Only an administrator can start impersonation' });
    const targetId = String(request.body?.user_id || '');
    const reason = String(request.body?.reason || '').trim();
    if (reason.length < 10 || reason.length > 500) return reply.code(400).send({ error: 'Enter an audit reason between 10 and 500 characters' });
    const targetResult = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
    const target = targetResult.rows[0];
    if (!target || target.status !== 'active') return reply.code(404).send({ error: 'Active user account not found' });
    if (target.role !== 'user') return reply.code(403).send({ error: 'Administrators can only impersonate standard user accounts' });

    const session = await createSession(target.id, request, reply, {
      mfaVerified: true,
      impersonatorUserId: actor.id,
      impersonationReason: reason,
      parentSessionId: actor._session_id,
    });
    await audit(actor, 'impersonation_started', target, reason, request, session.id);
    return { success: true, target: { id: target.id, email: target.email, display_name: target.display_name || target.full_name } };
  });

  app.post('/api/auth/impersonation/stop', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const target = await authenticateRequest(request);
    if (!target) return reply.code(401).send({ error: 'Unauthorized' });
    if (!target.impersonation?.active || !target._parent_session_id) return reply.code(409).send({ error: 'No impersonation session is active' });
    const actorResult = await pool.query(
      `SELECT admin.* FROM sessions parent
       JOIN users admin ON admin.id = parent.user_id
       WHERE parent.id = $1 AND admin.id = $2 AND parent.expires_at > now()
         AND admin.status = 'active' AND admin.role = 'admin'`,
      [target._parent_session_id, target.impersonation.actor_id],
    );
    const actor = actorResult.rows[0];
    if (!actor) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [target._session_id]);
      reply.clearCookie(config.cookieName, { path: '/' });
      return reply.code(401).send({ error: 'The administrator session has expired. Sign in again.' });
    }
    await audit(actor, 'impersonation_stopped', target, target.impersonation.reason, request, target._session_id);
    await pool.query('DELETE FROM sessions WHERE id = ANY($1::uuid[])', [[target._session_id, target._parent_session_id]]);
    await createSession(actor.id, request, reply, { mfaVerified: true });
    return { success: true };
  });
}
