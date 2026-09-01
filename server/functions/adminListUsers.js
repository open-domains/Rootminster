import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { pool } from '../database.js';
const ADMIN_USER_FIELDS = new Set(['display_name', 'full_name', 'role', 'status', 'ns_unlocked', 'legacy_donor', 'disable_email_notifications']);
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const actor = await platform.auth.me();
    if (!actor)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'admin' && actor.role !== 'staff')
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = req.method === 'POST' ? await req.json() : {};
    // Update user action
    if (body.action === 'update_user') {
        if (actor.role !== 'admin')
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        const { user_id, data } = body;
        if (!user_id || !data || typeof data !== 'object')
            return Response.json({ error: 'user_id and data are required' }, { status: 400 });
        const clean = Object.fromEntries(Object.entries(data).filter(([key]) => ADMIN_USER_FIELDS.has(key)));
        if (!Object.keys(clean).length)
            return Response.json({ error: 'No permitted user fields were supplied' }, { status: 400 });
        const before = await platform.asServiceRole.entities.User.get(user_id);
        if (!before)
            return Response.json({ error: 'User not found' }, { status: 404 });
        const updated = await platform.asServiceRole.entities.User.update(user_id, clean);
        if ((clean.role && clean.role !== before.role) || (clean.status && clean.status !== before.status)) {
            await Promise.all([
                pool.query('DELETE FROM sessions WHERE user_id = $1', [user_id]),
                pool.query('UPDATE mcp_oauth_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [user_id]),
            ]);
            const apiTokens = await platform.asServiceRole.entities.ApiToken.filter({ user_id });
            await Promise.all(apiTokens.filter((token) => token.revoked !== true).map((token) => platform.asServiceRole.entities.ApiToken.update(token.id, { revoked: true, revoked_at: new Date().toISOString(), revoked_by: actor.email })));
        }
        const { totp_secret: _secret, ...safeUser } = updated;
        return Response.json({ user: safeUser });
    }
    // Default: list users
    const users = await platform.asServiceRole.entities.User.list();
    return Response.json({ users: users.map(({ totp_secret: _secret, ...user }) => user) });
}
