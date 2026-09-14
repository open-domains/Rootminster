import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { pool } from '../database.js';

function utcWeekKey(date) {
  const end = new Date(date);
  end.setUTCHours(23, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - end.getUTCDay());
  return end.toISOString().slice(0, 10);
}

export default async function (req) {
  const platform = createPlatformClientFromRequest(req);
  const settings = await platform.asServiceRole.entities.PlatformSettings.filter({ key: 'discord_public_webhook_url' });
  const webhookUrl = settings?.[0]?.value;
  if (!webhookUrl) {
    return Response.json({ success: false, message: 'Public Discord webhook not configured' });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const notificationKey = `discord-weekly-stats:${utcWeekKey(now)}`;
  const claimed = await pool.query(
    `INSERT INTO scheduled_notifications(notification_key, status)
     VALUES ($1, 'sending')
     ON CONFLICT (notification_key) DO UPDATE
       SET status = 'sending', created_at = now(), sent_at = NULL
       WHERE scheduled_notifications.status = 'sending'
         AND scheduled_notifications.created_at < now() - interval '15 minutes'
     RETURNING notification_key`,
    [notificationKey],
  );
  if (!claimed.rowCount) return Response.json({ success: true, skipped: true, message: 'Weekly stats already sent' });

  try {
    const stats = await pool.query(
      `SELECT
         count(*) FILTER (WHERE entity_type = 'SubdomainRequest' AND created_at >= $1) AS new_requests,
         count(*) FILTER (WHERE entity_type = 'SubdomainRequest' AND created_at >= $1 AND data->>'status' = 'approved') AS approved,
         count(*) FILTER (WHERE entity_type = 'SubdomainRequest' AND created_at >= $1 AND data->>'status' = 'rejected') AS rejected,
         count(*) FILTER (WHERE entity_type = 'SubdomainRequest' AND data->>'status' = 'pending') AS pending,
         count(*) FILTER (WHERE entity_type = 'DnsRecord') AS dns_records
       FROM entity_records`,
      [weekAgo],
    );
    const users = await pool.query('SELECT count(*) AS new_users FROM users WHERE created_at >= $1', [weekAgo]);
    const counts = { ...stats.rows[0], ...users.rows[0] };
    const embed = {
      title: '📊 Weekly Stats — Open Domains',
      description: `Here's a summary of activity for the past 7 days.`,
      color: 0x6366f1,
      fields: [
        { name: '📨 New Requests', value: String(counts.new_requests), inline: true },
        { name: '✅ Approved', value: String(counts.approved), inline: true },
        { name: '❌ Rejected', value: String(counts.rejected), inline: true },
        { name: '⏳ Total Pending', value: String(counts.pending), inline: true },
        { name: '🌐 Total DNS Records', value: String(counts.dns_records), inline: true },
        { name: '👤 New Users', value: String(counts.new_users), inline: true },
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
      throw Object.assign(new Error('Discord rejected the weekly notification'), { details: text });
    }
    await pool.query("UPDATE scheduled_notifications SET status = 'sent', sent_at = now() WHERE notification_key = $1", [notificationKey]);
    return Response.json({ success: true });
  } catch (error) {
    await pool.query('DELETE FROM scheduled_notifications WHERE notification_key = $1', [notificationKey]).catch(() => {});
    return Response.json({ success: false, error: error.details || error.message }, { status: 500 });
  }
}
