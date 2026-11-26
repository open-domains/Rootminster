import { getModuleConfig } from '../core/module-settings.js';
export default async function () {
    const turnstile = await getModuleConfig('turnstile');
    return Response.json({ site_key: turnstile.enabled ? turnstile.site_key : '' });
}
