import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { pool } from '../database.js';
import { getModuleConfig } from '../module-settings.js';
import { FEEDS, feedSummary } from '../lib/threat-intel.js';

// Staff: how many hosts each imported feed currently holds, for the blocklist page.
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me().catch(() => null);
        if (!user || !['admin', 'staff'].includes(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
        const settings = await getModuleConfig('threat_intel');
        const rows = settings.enabled ? await feedSummary(pool) : [];
        return Response.json({
            enabled: Boolean(settings.enabled),
            blocking: Boolean(settings.enabled && settings.block_feed_targets),
            safe_browsing: Boolean(settings.safe_browsing_api_key),
            feeds: Object.entries(FEEDS).map(([id, feed]) => {
                const row = rows.find((item) => item.source === id);
                return { id, label: feed.label, enabled: Boolean(settings[feed.setting]), hosts: row?.hosts || 0, last_synced_at: row?.last_synced_at || null };
            }),
        });
    }
    catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
