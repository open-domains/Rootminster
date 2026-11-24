import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../config.js';
import { getModuleConfig } from '../module-settings.js';
import { createZammadTicket } from '../zammad.js';
import { acknowledgementEmail, escapeHtml, isOpenReport, mergedReportUpdate, newReporterSecret, reportedHostname, reporterEntry, statusToken } from '../lib/abuse-reports.js';

async function sendAcknowledgement(platform, email, host, token) {
    if (!email) return;
    const statusUrl = `${config.appUrl}/report-abuse/status/${encodeURIComponent(token)}`;
    const message = acknowledgementEmail({ host, statusUrl });
    await platform.asServiceRole.integrations.Core.SendEmail({ to: email, subject: message.subject, body: message.body }).catch(() => null);
}
export default async function (req) {
    try {
        const body = await req.json();
        const { subdomain, abuse_type, description, evidence, reporter_email, turnstile_token } = body;
        if (!subdomain || !abuse_type || !description) {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
        }
        const host = reportedHostname(subdomain);
        if (!host) {
            return Response.json({ error: "Enter the subdomain or URL you are reporting" }, { status: 400 });
        }
        const platform = createPlatformClientFromRequest(req);
        // Require and validate Turnstile whenever it is configured.
        const turnstile = await getModuleConfig('turnstile');
        if (turnstile.enabled && turnstile.secret_key) {
            if (!turnstile_token)
                return Response.json({ error: "Security check required" }, { status: 400 });
            const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    secret: turnstile.secret_key,
                    response: turnstile_token,
                }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
                return Response.json({ error: "Security check failed" }, { status: 400 });
            }
        }
        const reporterEmail = String(reporter_email || '').trim();
        const { secret, hash: secretHash } = newReporterSecret();
        const reporter = reporterEntry({ email: reporterEmail, tokenHash: secretHash });
        const statusResponse = (id, merged) => {
            const token = statusToken(id, secret);
            return Response.json({
                success: true,
                id,
                merged,
                status_token: token,
                status_url: `${config.appUrl}/report-abuse/status/${encodeURIComponent(token)}`,
            });
        };
        // A report about a host that already has an open report joins that report, so staff
        // see one item with a reporter count instead of a new ticket and email each time.
        const sameHost = await platform.asServiceRole.entities.AbuseReport.filter({ normalized_host: host });
        const existing = sameHost.filter(isOpenReport).sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)))[0];
        if (existing) {
            await platform.asServiceRole.entities.AbuseReport.update(existing.id, mergedReportUpdate(existing, { abuse_type, description, evidence, reporter_email: reporterEmail }, reporter));
            await sendAcknowledgement(platform, reporterEmail, host, statusToken(existing.id, secret));
            return statusResponse(existing.id, true);
        }
        // Save the abuse report
        const report = await platform.asServiceRole.entities.AbuseReport.create({
            subdomain,
            normalized_host: host,
            abuse_type,
            description,
            evidence: evidence || "",
            reporter_email: reporterEmail,
            reporters: [reporter],
            merged_reports: [],
            report_count: 1,
            last_reported_at: new Date().toISOString(),
            status: "open",
        });
        let actor = null;
        try {
            actor = await platform.auth.me();
        }
        catch (_) { }
        try {
            await createZammadTicket({
                category: 'abuse',
                subject: `${abuse_type}: ${subdomain}`,
                message: `${description}${evidence ? `\n\nEvidence:\n${evidence}` : ''}`,
                email: reporter_email || undefined,
                context: { abuse_report_id: report.id, subdomain, abuse_type, path: '/report-abuse' },
            }, actor);
        }
        catch (_) {
            // Non-fatal — the Rootminster abuse report is already saved.
        }
        const safeSubdomain = escapeHtml(subdomain);
        const safeType = escapeHtml(abuse_type);
        const safeReporter = escapeHtml(reporter_email || 'Anonymous');
        const safeDescription = escapeHtml(description).replace(/\n/g, '<br>');
        const safeEvidence = escapeHtml(evidence).replace(/\n/g, '<br>');
        // Notify all staff and admin users
        try {
            const allUsers = await platform.asServiceRole.entities.User.list();
            const recipients = allUsers.filter(u => u.role === "admin" || u.role === "staff");
            await Promise.all(recipients.map(u => platform.asServiceRole.integrations.Core.SendEmail({
                to: u.email,
                subject: `[ABUSE REPORT] ${String(abuse_type).slice(0, 80)}: ${String(subdomain).slice(0, 255)}`,
                body: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
    <div style="background: #dc2626; padding: 20px 24px;">
      <h1 style="margin: 0; color: #fff; font-size: 18px;">⚠️ New Abuse Report</h1>
      <p style="margin: 4px 0 0; color: #fca5a5; font-size: 13px;">Open Domains Safety Team</p>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 12px; background: #0f172a; border-radius: 6px; color: #94a3b8; font-size: 12px; font-weight: bold; width: 120px;">SUBDOMAIN</td>
          <td style="padding: 8px 12px; color: #818cf8; font-family: monospace; font-weight: bold;">${safeSubdomain}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #94a3b8; font-size: 12px; font-weight: bold;">ABUSE TYPE</td>
          <td style="padding: 8px 12px; color: #f87171; font-weight: bold;">${safeType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #94a3b8; font-size: 12px; font-weight: bold;">REPORTER</td>
          <td style="padding: 8px 12px; color: #e2e8f0;">${safeReporter}</td>
        </tr>
      </table>
      <div style="margin-top: 16px; padding: 16px; background: #0f172a; border-radius: 8px; border-left: 3px solid #dc2626;">
        <p style="margin: 0 0 6px; color: #94a3b8; font-size: 11px; font-weight: bold; text-transform: uppercase;">Description</p>
        <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.6;">${safeDescription}</p>
      </div>
      ${evidence ? `<div style="margin-top: 12px; padding: 16px; background: #0f172a; border-radius: 8px; border-left: 3px solid #64748b;">
        <p style="margin: 0 0 6px; color: #94a3b8; font-size: 11px; font-weight: bold; text-transform: uppercase;">Evidence</p>
        <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.6; word-break: break-all;">${safeEvidence}</p>
      </div>` : ""}
      <div style="margin-top: 20px; text-align: center;">
        <a href="${config.appUrl}/admin-abuse-reports" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">View in Admin Panel →</a>
      </div>
    </div>
    <div style="padding: 12px 24px; background: #0f172a; border-top: 1px solid #1e293b; text-align: center;">
      <p style="margin: 0; color: #475569; font-size: 11px;">This email was sent to all Open Domains staff and admins.</p>
    </div>
  </div>
</body>
</html>`,
            }).catch(() => null)));
        }
        catch (_) {
            // Non-fatal — report is already saved
        }
        await sendAcknowledgement(platform, reporterEmail, host, statusToken(report.id, secret));
        return statusResponse(report.id, false);
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
