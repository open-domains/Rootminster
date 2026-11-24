import { isIP } from 'node:net';

// Threat intelligence: public malware and phishing feeds synced into `threat_feed_hosts`,
// plus Google Safe Browsing lookups. Used to flag live subdomains, to add a signal to new
// requests, and (for hostname targets only) to refuse new DNS records that point at a
// listed host.

export const FEEDS = Object.freeze({
  urlhaus: { label: 'URLhaus', url: 'https://urlhaus.abuse.ch/downloads/hostfile/', setting: 'feed_urlhaus' },
  openphish: { label: 'OpenPhish', url: 'https://openphish.com/feed.txt', setting: 'feed_openphish' },
});

// Feeds list individual sites. A shared hosting suffix itself must never be treated as
// malicious, or one bad GitHub Pages site would block every github.io target.
export const SHARED_HOST_SUFFIXES = Object.freeze([
  'github.io', 'githubusercontent.com', 'github.com', 'gitlab.io', 'pages.dev', 'workers.dev', 'netlify.app', 'netlify.com',
  'vercel.app', 'vercel-dns.com', 'onrender.com', 'herokuapp.com', 'herokudns.com', 'fly.dev', 'railway.app', 'web.app',
  'firebaseapp.com', 'appspot.com', 'googleusercontent.com', 'blogspot.com', 'wordpress.com', 'wixsite.com',
  'weebly.com', 'square.site', 'azurewebsites.net', 'azureedge.net', 'cloudfront.net', 'amazonaws.com', 'cloudflare.net',
  'glitch.me', 'repl.co', 'replit.app', 'surge.sh', 'neocities.org', 'ngrok.io', 'ngrok-free.app', 'trycloudflare.com',
  'dropbox.com', 'docs.google.com', 'sites.google.com', 'drive.google.com', 'forms.gle', 'notion.site', 'carrd.co',
]);

const HOST_PATTERN = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/;

export function normalHost(value) {
  return String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
}

export function isSharedHostSuffix(host) {
  return SHARED_HOST_SUFFIXES.includes(normalHost(host));
}

// The host a feed line refers to: hosts-file lines ("127.0.0.1 evil.example"), bare
// hostnames or IPs, and full URLs. Comments and junk return null.
export function feedLineHost(line) {
  const text = String(line || '').trim();
  if (!text || text.startsWith('#') || text.startsWith('!')) return null;
  const parts = text.split(/\s+/);
  let candidate = parts.length > 1 && isIP(parts[0]) ? parts[1] : parts[0];
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      return null;
    }
  }
  const host = normalHost(candidate);
  if (!host || host === 'localhost' || host.length > 253) return null;
  if (isIP(host)) return host;
  return HOST_PATTERN.test(host) ? host : null;
}

export function parseFeed(text, { ignored = [] } = {}) {
  const skip = new Set([...ignored.map(normalHost), ...SHARED_HOST_SUFFIXES]);
  const hosts = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const host = feedLineHost(line);
    if (host && !skip.has(host)) hosts.add(host);
  }
  return hosts;
}

export function ignoredHosts(settings = {}) {
  return String(settings.ignored_hosts || '').split(/[\s,]+/).map(normalHost).filter(Boolean);
}

// The host a DNS record's content points at, or null for record types with no target.
export function recordTargetHost(type, content) {
  const value = String(content || '').trim();
  const kind = String(type || '').toUpperCase();
  if (kind === 'A' || kind === 'AAAA') return isIP(value) ? normalHost(value) : null;
  if (kind === 'CNAME' || kind === 'NS') return normalHost(value) || null;
  if (kind === 'MX') return normalHost(value.replace(/^\d+\s+/, '')) || null;
  if (kind === 'SRV') return normalHost(value.split(/\s+/).pop()) || null;
  return null;
}

export async function syncFeeds({ db, settings, fetchImpl = fetch, now = new Date() }) {
  const ignored = ignoredHosts(settings);
  const summary = {};
  for (const [source, feed] of Object.entries(FEEDS)) {
    if (!settings[feed.setting]) continue;
    try {
      const response = await fetchImpl(feed.url, { headers: { 'User-Agent': 'Rootminster threat intel' }, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const hosts = [...parseFeed(await response.text(), { ignored })];
      // A feed that suddenly returns almost nothing is more likely broken than clean, so
      // keep the previous entries rather than expiring them all.
      if (!hosts.length) throw new Error('feed returned no hosts');
      for (let i = 0; i < hosts.length; i += 1000) {
        await db.query(
          `INSERT INTO threat_feed_hosts (host, source, first_seen_at, last_seen_at)
           SELECT unnest($1::text[]), $2, $3, $3
           ON CONFLICT (host, source) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
          [hosts.slice(i, i + 1000), source, now.toISOString()],
        );
      }
      summary[source] = { hosts: hosts.length };
    } catch (error) {
      summary[source] = { error: error.message };
    }
  }
  const expiryDays = Math.min(Math.max(Number(settings.feed_expiry_days) || 7, 1), 90);
  const expired = await db.query(
    'DELETE FROM threat_feed_hosts WHERE last_seen_at < $1',
    [new Date(now.getTime() - expiryDays * 86_400_000).toISOString()],
  );
  summary.expired = expired.rowCount || 0;
  if (ignored.length) await db.query('DELETE FROM threat_feed_hosts WHERE host = ANY($1::text[])', [ignored]);
  return summary;
}

export async function lookupFeedHosts(db, hosts) {
  const list = [...new Set(hosts.map(normalHost).filter(Boolean))];
  if (!list.length) return new Map();
  const result = await db.query('SELECT host, source FROM threat_feed_hosts WHERE host = ANY($1::text[])', [list]);
  const found = new Map();
  for (const row of result.rows) found.set(row.host, [...(found.get(row.host) || []), row.source]);
  return found;
}

export async function feedSummary(db) {
  const result = await db.query('SELECT source, count(*)::int AS hosts, max(last_seen_at) AS last_synced_at FROM threat_feed_hosts GROUP BY source');
  return result.rows;
}

const SAFE_BROWSING_TYPES = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'];

// Google Safe Browsing Lookup API v4. Returns Map(url -> [threat types]).
export async function safeBrowsingLookup(urls, apiKey, { fetchImpl = fetch } = {}) {
  const found = new Map();
  const list = [...new Set(urls.filter(Boolean))];
  if (!apiKey || !list.length) return found;
  for (let i = 0; i < list.length; i += 500) {
    const response = await fetchImpl(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'rootminster', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: SAFE_BROWSING_TYPES,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: list.slice(i, i + 500).map((url) => ({ url })),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Safe Browsing returned HTTP ${response.status}`);
    const data = await response.json();
    for (const match of Array.isArray(data?.matches) ? data.matches : []) {
      const url = match?.threat?.url;
      if (url) found.set(url, [...new Set([...(found.get(url) || []), match.threatType])]);
    }
  }
  return found;
}

export function hostUrls(host) {
  return [`http://${host}/`, `https://${host}/`];
}

// Checks hostnames (the site itself) and targets (what its records point at). Returns a
// list of matches: { host, indicator, kind: 'site' | 'target', source, detail }.
export async function checkThreats({ db, settings, sites = [], targets = [], urls = [], fetchImpl = fetch }) {
  const matches = [];
  const ignored = new Set(ignoredHosts(settings));
  const siteHosts = sites.map(normalHost).filter((host) => host && !ignored.has(host));
  const targetPairs = targets
    .map((item) => ({ host: normalHost(item.host), target: normalHost(item.target) }))
    .filter((item) => item.target && !ignored.has(item.target) && !isSharedHostSuffix(item.target));

  const feedHits = await lookupFeedHosts(db, [...siteHosts, ...targetPairs.map((item) => item.target)]);
  for (const host of siteHosts) {
    for (const source of feedHits.get(host) || []) matches.push({ host, indicator: host, kind: 'site', source, detail: `${FEEDS[source]?.label || source} lists this hostname` });
  }
  for (const { host, target } of targetPairs) {
    for (const source of feedHits.get(target) || []) matches.push({ host, indicator: target, kind: 'target', source, detail: `${FEEDS[source]?.label || source} lists the DNS target ${target}` });
  }

  if (settings.safe_browsing_api_key) {
    const lookups = new Map();
    for (const host of siteHosts) for (const url of hostUrls(host)) lookups.set(url, { host, kind: 'site' });
    for (const { host, target } of targetPairs) if (!isIP(target)) for (const url of hostUrls(target)) lookups.set(url, { host, kind: 'target', target });
    for (const item of urls) if (item?.url) lookups.set(item.url, { host: normalHost(item.host), kind: 'link' });
    const hits = await safeBrowsingLookup([...lookups.keys()], settings.safe_browsing_api_key, { fetchImpl });
    const seen = new Set();
    for (const [url, types] of hits) {
      const origin = lookups.get(url);
      if (!origin) continue;
      const indicator = origin.target || (origin.kind === 'link' ? url : origin.host);
      const key = `${origin.host}|${indicator}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ host: origin.host, indicator, kind: origin.kind, source: 'safe_browsing', detail: `Google Safe Browsing flags ${indicator} (${types.join(', ')})` });
    }
  }
  return matches;
}

export function matchKey(match) {
  return `${match.source}:${match.kind}:${match.indicator}`;
}

// Refuses a new DNS record whose hostname target is on an imported feed. IP addresses are
// only flagged, never blocked, because many unrelated sites share hosting IPs.
export async function blockedFeedTarget({ db, settings, type, content }) {
  if (!settings?.enabled || !settings.block_feed_targets) return null;
  const target = recordTargetHost(type, content);
  if (!target || isIP(target) || isSharedHostSuffix(target) || ignoredHosts(settings).includes(target)) return null;
  const hits = await lookupFeedHosts(db, [target]);
  const sources = hits.get(target);
  return sources?.length ? { target, sources } : null;
}

export function blockedTargetMessage(blocked) {
  const labels = blocked.sources.map((source) => FEEDS[source]?.label || source).join(', ');
  return `This record value is not permitted: ${blocked.target} is listed by ${labels} as malicious`;
}
