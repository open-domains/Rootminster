import { createPlatformClientFromRequest } from '../lib/platform-client.js';
const COLORS = {
    new_request: 0x6366f1, // indigo
    edit_request: 0x8b5cf6, // purple
    approved: 0x10b981, // green
    rejected: 0xef4444, // red
    needs_info: 0xf59e0b, // amber
    sync_failed: 0xef4444, // red
    system_error: 0xef4444, // red
};
async function getWebhookUrl(platform) {
    try {
        const settings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_webhook_url' });
        return settings?.[0]?.value || null;
    }
    catch {
        return null;
    }
}
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const { event_type, title, description, fields = [], color } = body;
    const webhookUrl = await getWebhookUrl(platform);
    if (!webhookUrl) {
        return Response.json({ success: false, message: 'Discord webhook not configured' });
    }
    const embed = {
        title: title || 'Open Domains Notification',
        description: description || '',
        color: color || COLORS[event_type] || 0x6366f1,
        fields: fields.map(f => ({ name: f.name, value: String(f.value || '—'), inline: f.inline !== false })),
        timestamp: new Date().toISOString(),
        footer: { text: 'Open Domains Platform' }
    };
    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
    });
    if (!res.ok) {
        const text = await res.text();
        return Response.json({ success: false, error: text }, { status: 500 });
    }
    return Response.json({ success: true });
}
