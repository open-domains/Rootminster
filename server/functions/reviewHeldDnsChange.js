import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { invokeInternal } from '../function-runner.js';
import { escapeHtml } from '../lib/abuse-reports.js';

// Staff: approve or reject a DNS change that re-screening held for review. Approving
// applies the change exactly as the user submitted it, on the user's behalf.
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me().catch(() => null);
        if (!user || !['admin', 'staff'].includes(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        const decision = String(body.decision || '');
        if (!['approve', 'reject'].includes(decision)) return Response.json({ error: 'decision must be approve or reject' }, { status: 400 });
        const rows = body.id ? await platform.asServiceRole.entities.EditRequest.filter({ id: body.id }) : [];
        const held = rows[0];
        if (!held || held.kind !== 'dns_change') return Response.json({ error: 'Held change not found' }, { status: 404 });
        if (held.status !== 'pending') return Response.json({ error: `This change was already ${held.status}` }, { status: 409 });
        const note = String(body.note || '').slice(0, 2000);
        const proposed = held.proposed || {};

        let applied = null;
        if (decision === 'approve') {
            const payload = held.action === 'update'
                ? { action: 'update', record_id: held.record_id, name: proposed.name, record_type: proposed.record_type, content: proposed.content, ttl: proposed.ttl, proxied: proposed.proxied, priority: proposed.priority, cname_flatten: proposed.cname_flatten }
                : { action: 'create', name: proposed.name, record_type: proposed.record_type, content: proposed.content, ttl: proposed.ttl, proxied: proposed.proxied, priority: proposed.priority, cname_flatten: proposed.cname_flatten, base_name: proposed.base_name, owner_email: held.requester_email };
            try {
                applied = await invokeInternal('manageDnsRecord', payload, user);
            }
            catch (error) {
                return Response.json({ error: `Could not apply the change: ${error.message}` }, { status: error.status || 422 });
            }
        }
        const status = decision === 'approve' ? 'approved' : 'rejected';
        await platform.asServiceRole.entities.EditRequest.update(held.id, {
            status,
            reviewed_by: user.email,
            reviewed_at: new Date().toISOString(),
            admin_notes: note,
            applied_record_id: applied?.record?.id || held.record_id || null,
        });
        await platform.asServiceRole.entities.AuditLog.create({
            actor_email: user.email,
            actor_role: user.role,
            action: `dns_change_${status}`,
            entity_type: 'EditRequest',
            entity_id: held.id,
            description: `${status === 'approved' ? 'Approved' : 'Rejected'} held ${held.action} of ${held.hostname}`,
        }).catch(() => null);
        if (held.requester_email) {
            const change = `${escapeHtml(proposed.record_type)} ${escapeHtml(held.hostname)} → ${escapeHtml(proposed.content)}`;
            await platform.asServiceRole.integrations.Core.SendEmail({
                to: held.requester_email,
                subject: status === 'approved' ? `Your DNS change for ${held.hostname} was approved` : `Your DNS change for ${held.hostname} was not approved`,
                body: `<p>Your DNS change <code>${change}</code> ${status === 'approved' ? 'was approved and is now live.' : 'was reviewed and not applied.'}</p>${status === 'rejected' && note ? `<p>Reviewer note: ${escapeHtml(note)}</p>` : ''}`,
            }).catch(() => null);
        }
        return Response.json({ success: true, status, record: applied?.record || null });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
