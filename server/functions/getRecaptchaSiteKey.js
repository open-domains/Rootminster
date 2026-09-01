import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { getModuleConfig } from '../module-settings.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user)
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const turnstile = await getModuleConfig('turnstile');
    return Response.json({ site_key: turnstile.enabled ? turnstile.site_key : '' });
}
