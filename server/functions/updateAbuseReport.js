import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { CLOSED_STATUSES, closedEmail, reportersToNotify } from '../lib/abuse-reports.js';

const STATUSES = new Set(['open', 'investigating', 'resolved', 'dismissed']);

// Staff: change a report's status and notes. Closing a report emails every reporter who
// left an address, once per closed status.
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me().catch(() => null);
        if (!user || !['admin', 'staff'].includes(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        const rows = body.id ? await platform.asServiceRole.entities.AbuseReport.filter({ id: body.id }) : [];
        const report = rows[0];
        if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
        const status = body.status === undefined ? report.status : String(body.status);
        if (!STATUSES.has(status)) return Response.json({ error: 'Unknown status' }, { status: 400 });
        const now = new Date().toISOString();
        const updates = { status, actioned_by: user.email };
        if (body.admin_notes !== undefined) updates.admin_notes = String(body.admin_notes).slice(0, 10_000);
        if (status !== report.status) updates.status_changed_at = now;

        const recipients = reportersToNotify(report, status);
        const notified = new Set();
        if (recipients.length) {
            const host = report.normalized_host || report.subdomain;
            const message = closedEmail({ host, status });
            for (const reporter of recipients) {
                const key = reporter.email.toLowerCase();
                if (notified.has(key)) continue;
                try {
                    await platform.asServiceRole.integrations.Core.SendEmail({ to: reporter.email, subject: message.subject, body: message.body });
                    notified.add(key);
                }
                catch (_) {
                    // Leave notified_status unset so a later save retries this reporter.
                }
            }
            updates.reporters = report.reporters.map((item) => item.email && notified.has(item.email.toLowerCase()) ? { ...item, notified_status: status } : item);
        }
        const updated = await platform.asServiceRole.entities.AbuseReport.update(report.id, updates);
        await platform.asServiceRole.entities.AuditLog.create({
            actor_email: user.email,
            actor_role: user.role,
            action: 'abuse_report_updated',
            entity_type: 'AbuseReport',
            entity_id: report.id,
            description: `Set abuse report for ${report.normalized_host || report.subdomain} to ${status}${CLOSED_STATUSES.has(status) && notified.size ? ` and notified ${notified.size} reporter(s)` : ''}`,
        }).catch(() => null);
        return Response.json({ success: true, report: updated, notified: notified.size });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
