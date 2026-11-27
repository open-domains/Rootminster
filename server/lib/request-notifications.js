// Notifications sent when a subdomain request is approved, by staff or automatically.
import { config } from '../core/config.js';
import { platformName } from './platform-name.js';
import { requestApprovedEmail } from '../../shared/email-templates.js';
export async function notifyRequestApproved(platform, r, bundle, reviewerName, actor) {
    const recordTypes = bundle._records.map(record => record.record_type).join(', ');
    const recordValues = bundle._records.map(record => record.record_value).join('; ');
    // Send approval email
    try {
        await platform.asServiceRole.integrations.Core.SendEmail({
            to: r.requester_email,
            ...requestApprovedEmail({ platform: await platformName(), appUrl: config.appUrl, hostname: `${r.subdomain}.${r.root_domain}`, recordType: recordTypes, recordValue: recordValues })
        });
        await platform.asServiceRole.entities.EmailLog.create({
            to: r.requester_email, subject: `Subdomain approved: ${r.subdomain}.${r.root_domain}`,
            template_type: 'request_approved', status: 'sent',
            related_entity_type: 'SubdomainRequest', related_entity_id: r.id
        });
    }
    catch (e) {
        await platform.asServiceRole.entities.EmailLog.create({
            to: r.requester_email, subject: `Subdomain Approved`, template_type: 'request_approved',
            status: 'failed', error_message: e.message
        });
    }
    await platform.asServiceRole.entities.AuditLog.create({
        actor_email: actor.email, actor_role: actor.role || 'admin',
        action: 'request_approved', entity_type: 'SubdomainRequest', entity_id: r.id,
        description: `Approved by ${reviewerName}: ${r.subdomain}.${r.root_domain}`
    });
    // Discord notification
    try {
        const discordSettings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_webhook_url' });
        const discordUrl = discordSettings?.[0]?.value;
        if (discordUrl) {
            const discordEmbed = {
                title: 'Request Approved',
                color: 0x10b981,
                fields: [
                    { name: 'Subdomain', value: String(r.subdomain + '.' + r.root_domain), inline: true },
                    { name: 'Type', value: recordTypes, inline: true },
                    { name: 'User', value: String(r.requester_email), inline: true },
                    { name: 'Approved By', value: String(reviewerName), inline: true }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: `${await platformName()} Platform` }
            };
            await fetch(discordUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [discordEmbed] })
            });
        }
    }
    catch (_) { }
}
