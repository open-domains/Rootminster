import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { getModuleConfig } from '../module-settings.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { github_email } = await req.json();
    if (!github_email)
        return Response.json({ error: 'github_email is required' }, { status: 400 });
    const normalizedEmail = github_email.toLowerCase().trim();
    // Fetch the index and check this email has domains
    const github = await getModuleConfig('github_oauth');
    const res = await fetch(github.registry_url, { headers: { 'User-Agent': 'OpenDomains-Platform' } });
    if (!res.ok)
        return Response.json({ error: 'Failed to fetch domain index' }, { status: 502 });
    const allRecords = await res.json();
    const matched = allRecords.filter(data => data.subdomain && !data.subdomain.startsWith('*.') &&
        data.owner?.email?.toLowerCase().trim() === normalizedEmail);
    if (matched.length === 0) {
        return Response.json({ found: 0, message: 'No domains found for this email in the old system.' });
    }
    // Generate a 6-digit code and store it keyed by user+email
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const settingKey = `migrate_verify_${user.id}_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`;
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min
    // Upsert the verification record
    const existing = await platform.asServiceRole.entities.PlatformSettings.filter({ key: settingKey });
    if (existing.length > 0) {
        await platform.asServiceRole.entities.PlatformSettings.update(existing[0].id, {
            value: JSON.stringify({ code, expiresAt })
        });
    }
    else {
        await platform.asServiceRole.entities.PlatformSettings.create({
            key: settingKey,
            value: JSON.stringify({ code, expiresAt }),
            description: 'Temporary GitHub migration verification code'
        });
    }
    // Send the verification code to the logged-in user's email (platform restriction: can only send to app users)
    await platform.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: 'Your Open Domains migration verification code',
        body: `
      <p>Hi ${user.full_name || user.email},</p>
      <p>You requested to migrate domains registered under <strong>${normalizedEmail}</strong> to your Open Domains account.</p>
      <p>Your verification code is:</p>
      <h2 style="letter-spacing:4px;font-size:32px;font-family:monospace;">${code}</h2>
      <p>This code expires in 15 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `
    });
    return Response.json({ found: matched.length, sent: true });
}
