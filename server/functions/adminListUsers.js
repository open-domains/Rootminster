import { createPlatformClientFromRequest } from '../lib/platform-client.js';
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
        const updated = await platform.asServiceRole.entities.User.update(user_id, data);
        const { totp_secret: _secret, ...safeUser } = updated;
        return Response.json({ user: safeUser });
    }
    // Default: list users
    const users = await platform.asServiceRole.entities.User.list();
    return Response.json({ users: users.map(({ totp_secret: _secret, ...user }) => user) });
}
