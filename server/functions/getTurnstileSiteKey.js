import { getModuleConfig } from '../module-settings.js';
export default async function (req) {
    const turnstile = await getModuleConfig('turnstile');
    return Response.json({ site_key: turnstile.enabled ? turnstile.site_key : '' });
}
