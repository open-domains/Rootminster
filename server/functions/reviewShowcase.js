import { createPlatformClientFromRequest } from '../lib/platform-client.js';

// Staff: list pending showcase submissions and approve or reject them.
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me().catch(() => null);
        if (!user || !['admin', 'staff'].includes(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        const entities = platform.asServiceRole.entities;
        if (!body.action || body.action === 'list') {
            return Response.json({ pending: await entities.ShowcaseEntry.filter({ status: 'pending' }, 'submitted_at', 200) });
        }
        if (!['approve', 'reject'].includes(body.action)) return Response.json({ error: 'Unknown action' }, { status: 400 });
        const entry = body.id ? (await entities.ShowcaseEntry.filter({ id: body.id }))[0] : null;
        if (!entry) return Response.json({ error: 'Listing not found' }, { status: 404 });
        const approved = body.action === 'approve';
        const note = String(body.note || '').slice(0, 500);
        const updated = await entities.ShowcaseEntry.update(entry.id, {
            status: approved ? 'approved' : 'rejected',
            review_note: note,
            reviewed_by: user.email,
            ...(approved ? { approved_at: new Date().toISOString(), health_status: null } : {}),
        });
        await entities.AuditLog.create({
            actor_email: user.email, actor_role: user.role,
            action: approved ? 'showcase_approved' : 'showcase_rejected',
            entity_type: 'ShowcaseEntry', entity_id: entry.id,
            description: `${approved ? 'Approved' : 'Rejected'} showcase listing for ${entry.hostname}`,
        }).catch(() => null);
        if (entry.owner_email) {
            await platform.asServiceRole.integrations.Core.SendEmail({
                to: entry.owner_email,
                subject: approved ? `${entry.hostname} is now in the showcase` : `Your showcase listing for ${entry.hostname} was not approved`,
                body: approved
                    ? `<p>Your project is now listed in the public showcase.</p>`
                    : `<p>Your showcase listing was not approved.</p>${note ? `<p>Reviewer note: ${note.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])}</p>` : ''}<p>You can edit and resubmit it from the DNS manager.</p>`,
            }).catch(() => null);
        }
        return Response.json({ success: true, listing: updated });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
