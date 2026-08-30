import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { config } from '../config.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ site_key: config.turnstileSiteKey });
}
