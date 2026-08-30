import { config } from '../config.js';
export default async function (req) {
    return Response.json({ site_key: config.turnstileSiteKey });
}
