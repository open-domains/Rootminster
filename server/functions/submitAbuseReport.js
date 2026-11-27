import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../core/config.js';
import { getModuleConfig } from '../core/module-settings.js';
import { acknowledgementEmail, isOpenReport, mergedReportUpdate, newReporterSecret, reportedHostname, reporterEntry, statusToken } from '../lib/abuse-reports.js';
import { platformName } from '../lib/platform-name.js';
import { abuseReportStaffEmail } from '../../shared/email-templates.js';

async function sendAcknowledgement(platform, email, host, token) {
    if (!email) return;
    const statusUrl = `${config.appUrl}/report-abuse/status/${encodeURIComponent(token)}`;
    const message = acknowledgementEmail({ host, statusUrl });
    await platform.asServiceRole.integrations.Core.SendEmail({ to: email, ...message }).catch(() => null);
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
        // Notify all staff and admin users
        try {
            const allUsers = await platform.asServiceRole.entities.User.list();
            const recipients = allUsers.filter(u => u.role === "admin" || u.role === "staff");
            const alert = abuseReportStaffEmail({
                platform: await platformName(),
                appUrl: config.appUrl,
                subdomain: String(subdomain).slice(0, 255),
                abuseType: String(abuse_type).slice(0, 80),
                reporter: reporter_email || 'Anonymous',
                description,
                evidence,
            });
            await Promise.all(recipients.map(u => platform.asServiceRole.integrations.Core.SendEmail({
                to: u.email,
                ...alert,
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
