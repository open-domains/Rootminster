import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { buildDomainHealth, normalizeName, validHealthName, withinName } from '../lib/domain-health.js';

export function createHealthHandler({ clientFor = createPlatformClientFromRequest, check = buildDomainHealth, now = Date.now } = {}) {
  const recent = new Map();
  return async function checkDomainHealth(req) {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
    try {
      const platform = clientFor(req);
      const user = await platform.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const payload = await req.json().catch(() => null);
      const name = typeof payload?.name === 'string' ? normalizeName(payload.name) : '';
      if (!validHealthName(name)) return Response.json({ error: 'Provide a valid subdomain name.' }, { status: 400 });
      // This endpoint always checks the caller's records, including for staff.
      const [owned, records] = await Promise.all([
        platform.asServiceRole.entities.SubdomainOwnership.filter({ owner_id: user.id }),
        platform.asServiceRole.entities.DnsRecord.filter({ owner_id: user.id, managed: true }),
      ]);
      if (!owned.some(item => withinName(name, normalizeName(item.full_name)) && item.full_name) && !records.some(record => normalizeName(record.name) === name)) {
        return Response.json({ error: 'You do not own this subdomain.' }, { status: 403 });
      }
      const timestamp = now();
      for (const [id, expiry] of recent) if (expiry <= timestamp) recent.delete(id);
      if (recent.has(user.id)) return Response.json({ error: 'Wait 30 seconds between health checks.' }, { status: 429, headers: { 'Retry-After': '30' } });
      if (recent.size >= 5000) return Response.json({ error: 'Health checks are busy. Try again shortly.' }, { status: 503 });
      recent.set(user.id, timestamp + 30_000);
      const scoped = records.filter(record => withinName(normalizeName(record.name), name)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return Response.json(await check(name, scoped), { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return Response.json({ error: error.status === 401 ? 'Unauthorized' : 'Could not run the health check. Try again shortly.' }, { status: error.status === 401 ? 401 : 500 });
    }
  };
}
export default createHealthHandler();
