import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../config.js';
import { getModuleConfig } from '../module-settings.js';
function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
export default async function (req) {
    try {
        const body = await req.json();
        const { subdomain, abuse_type, description, evidence, reporter_email, turnstile_token } = body;
        if (!subdomain || !abuse_type || !description) {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
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
        // Save the abuse report
        const report = await platform.asServiceRole.entities.AbuseReport.create({
            subdomain,
            abuse_type,
            description,
            evidence: evidence || "",
            reporter_email: reporter_email || "",
            status: "open",
        });
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
                body: `<p style="color:#d63939;font-weight:600">New abuse report</p>
                  <table role="presentation" width="100%" style="background:#f6f8fb;border:1px solid #dce1e7;border-radius:6px;padding:12px">
                    <tr><td>Subdomain</td><td>${safeSubdomain}</td></tr>
                    <tr><td>Abuse type</td><td>${safeType}</td></tr>
                    <tr><td>Reporter</td><td>${safeReporter}</td></tr>
                  </table><p><strong>Description</strong><br>${safeDescription}</p>
                  ${evidence ? `<p><strong>Evidence</strong><br>${safeEvidence}</p>` : ''}
                  <p><a href="${config.appUrl}/admin-abuse-reports" style="display:inline-block;background:#206bc4;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">View report</a></p>`,
            }).catch(() => null)));
        }
        catch (_) {
            // Non-fatal — report is already saved
        }
        return Response.json({ success: true, id: report.id });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
