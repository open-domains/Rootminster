import { createPlatformClientFromRequest } from '../lib/platform-client.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    // Get the public Discord webhook URL from settings
    const settings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_public_webhook_url' });
    const webhookUrl = settings?.[0]?.value;
    if (!webhookUrl) {
        return Response.json({ success: false, message: 'Public Discord webhook not configured' });
    }
    // Calculate the start of the past week
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Fetch data
    const [allRequests, allRecords, allUsers] = await Promise.all([
        platform.asServiceRole.entities.SubdomainRequest.list(),
        platform.asServiceRole.entities.DnsRecord.list(),
        platform.asServiceRole.entities.User.list(),
    ]);
    const weekRequests = allRequests.filter(r => new Date(r.created_date) >= weekAgo);
    const approved = weekRequests.filter(r => r.status === 'approved').length;
    const rejected = weekRequests.filter(r => r.status === 'rejected').length;
    const pending = allRequests.filter(r => r.status === 'pending').length;
    const newUsers = allUsers.filter(u => new Date(u.created_date) >= weekAgo).length;
    const embed = {
        title: '📊 Weekly Stats — Open Domains',
        description: `Here's a summary of activity for the past 7 days.`,
        color: 0x6366f1,
        fields: [
            { name: '📨 New Requests', value: String(weekRequests.length), inline: true },
            { name: '✅ Approved', value: String(approved), inline: true },
            { name: '❌ Rejected', value: String(rejected), inline: true },
            { name: '⏳ Total Pending', value: String(pending), inline: true },
            { name: '🌐 Total DNS Records', value: String(allRecords.length), inline: true },
            { name: '👤 New Users', value: String(newUsers), inline: true },
        ],
        timestamp: now.toISOString(),
        footer: { text: 'Open Domains Platform' },
    };
    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
        const text = await res.text();
        return Response.json({ success: false, error: text }, { status: 500 });
    }
    return Response.json({ success: true });
}
