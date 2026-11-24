import { buildDomainHealth, normalizeName, withinName } from './domain-health.js';

// Runs the domain health check for every approved showcase listing and stores the result,
// so the public page can hide sites that no longer resolve.
export async function refreshShowcaseHealth({ store, check = buildDomainHealth, now = new Date() }) {
  const entries = await store.filter('ShowcaseEntry', { status: 'approved' }, 'hostname', 1000);
  let hidden = 0;
  for (const entry of entries) {
    const hostname = normalizeName(entry.hostname);
    const records = (await store.filter('DnsRecord', { owner_id: entry.owner_id, managed: true }, 'name', 10_000))
      .filter((record) => withinName(normalizeName(record.name), hostname));
    let status = 'unknown';
    try {
      status = (await check(hostname, records)).status;
    } catch {
      status = 'unknown';
    }
    // Only a definite warning hides a listing; a resolver outage must not empty the page.
    if (status === 'warning') hidden++;
    await store.update('ShowcaseEntry', entry.id, { health_status: status === 'warning' ? 'warning' : 'ok', health_checked_at: now.toISOString() });
  }
  return { checked: entries.length, hidden };
}
