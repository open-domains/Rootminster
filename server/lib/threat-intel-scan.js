import { checkThreats, matchKey, normalHost, recordTargetHost } from './threat-intel.js';
import { escapeHtml, isOpenReport } from './abuse-reports.js';

const DISMISSED_SUPPRESSION_MS = 30 * 86_400_000;
const REPORTER = 'Threat intelligence';

async function listAll(store, entity, filter) {
  const rows = [];
  for (let skip = 0; ; skip += 5000) {
    const page = await store.filter(entity, filter, 'created_date', 5000, skip);
    rows.push(...page);
    if (page.length < 5000) return rows;
  }
}

// The site a record belongs to: the active SubdomainOwnership that contains it, so a match
// on www.foo.example.com or its target is reported against foo.example.com.
function ownerSite(name, ownerships) {
  const host = normalHost(name);
  let best = null;
  for (const item of ownerships) {
    const base = normalHost(item.full_name);
    if (base && (host === base || host.endsWith(`.${base}`)) && (!best || base.length > best.length)) best = base;
  }
  return best || host;
}

export function groupMatches(matches) {
  const bySite = new Map();
  for (const match of matches) {
    const list = bySite.get(match.host) || [];
    if (!list.some((item) => matchKey(item) === matchKey(match))) list.push(match);
    bySite.set(match.host, list);
  }
  return bySite;
}

// Decides what to do with a site's matches given the abuse reports that already exist
// for it: skip keys already reported on an open report, or dismissed in the last 30 days.
export function newMatchesForSite(matches, reports, now = new Date()) {
  const known = new Set();
  for (const report of reports) {
    const keys = Array.isArray(report.threat_intel_keys) ? report.threat_intel_keys : [];
    const changed = new Date(report.status_changed_at || report.updated_date || 0).getTime();
    if (isOpenReport(report) || (report.status === 'dismissed' && now.getTime() - changed < DISMISSED_SUPPRESSION_MS)) {
      for (const key of keys) known.add(key);
    }
  }
  return matches.filter((match) => !known.has(matchKey(match)));
}

function describe(matches) {
  return matches.map((match) => `- ${match.detail}`).join('\n');
}

export async function scanLiveSubdomains({ store, db, settings, fetchImpl, now = new Date(), sendStaffEmail }) {
  const [records, ownerships] = await Promise.all([
    listAll(store, 'DnsRecord', { managed: true }),
    listAll(store, 'SubdomainOwnership', {}),
  ]);
  const activeOwnerships = ownerships.filter((item) => item.status !== 'suspended');
  const live = records.filter((record) => !record.status || record.status === 'active');
  const sites = new Set(activeOwnerships.map((item) => normalHost(item.full_name)).filter(Boolean));
  const targets = [];
  for (const record of live) {
    const site = ownerSite(record.name, activeOwnerships);
    sites.add(site);
    const target = recordTargetHost(record.record_type, record.content);
    if (target) targets.push({ host: site, target });
  }
  const matches = await checkThreats({ db, settings, sites: [...sites], targets, fetchImpl });
  const grouped = groupMatches(matches);

  let created = 0;
  let merged = 0;
  const reported = [];
  for (const [site, siteMatches] of grouped) {
    const reports = await store.filter('AbuseReport', { normalized_host: site }, '-created_date', 200);
    const fresh = newMatchesForSite(siteMatches, reports, now);
    if (!fresh.length) continue;
    const keys = fresh.map(matchKey);
    const open = reports.filter(isOpenReport).sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)))[0];
    const entry = { abuse_type: 'Threat feed match', description: describe(fresh), evidence: fresh.map((match) => match.indicator).join('\n'), reporter_email: '', submitted_at: now.toISOString(), source: 'threat_intel' };
    if (open) {
      await store.update('AbuseReport', open.id, {
        merged_reports: [...(Array.isArray(open.merged_reports) ? open.merged_reports : []), entry].slice(-100),
        report_count: Number(open.report_count || 1) + 1,
        threat_intel_keys: [...new Set([...(open.threat_intel_keys || []), ...keys])],
        last_reported_at: now.toISOString(),
      });
      merged++;
    } else {
      await store.create('AbuseReport', {
        subdomain: site,
        normalized_host: site,
        abuse_type: 'Threat feed match',
        description: `Automated check found this subdomain on a threat list.\n\n${describe(fresh)}`,
        evidence: entry.evidence,
        reporter_email: '',
        reporter_name: REPORTER,
        source: 'threat_intel',
        threat_intel_keys: keys,
        reporters: [],
        merged_reports: [],
        report_count: 1,
        last_reported_at: now.toISOString(),
        status: 'open',
      });
      created++;
    }
    reported.push({ site, matches: fresh });
  }

  if (reported.length && settings.notify_staff && sendStaffEmail) {
    const rows = reported.map(({ site, matches: list }) => `<li><strong style="font-family: monospace;">${escapeHtml(site)}</strong><ul>${list.map((match) => `<li>${escapeHtml(match.detail)}</li>`).join('')}</ul></li>`).join('');
    await sendStaffEmail({
      subject: `[Threat intel] ${reported.length} subdomain${reported.length === 1 ? '' : 's'} matched a threat list`,
      body: `<p>The daily threat intelligence check found new matches. Each one is in Admin → Abuse Reports. Nothing was suspended.</p><ul>${rows}</ul>`,
    }).catch(() => null);
  }
  return { sites: sites.size, targets: targets.length, matches: matches.length, created, merged };
}

// Threat check for a new request: the requested hostname, its DNS targets and the preview
// link. Returns matches; never throws (a failed lookup must not block a submission).
export async function checkRequestThreats({ db, settings, request, fetchImpl }) {
  if (!settings?.enabled) return { matches: [], error: null };
  const host = normalHost(`${request.subdomain}.${request.root_domain}`);
  const records = Array.isArray(request.records) && request.records.length ? request.records : [request];
  const targets = records.map((record) => ({ host, target: recordTargetHost(record.record_type, record.record_value) })).filter((item) => item.target);
  const urls = [];
  if (request.preview_link) urls.push({ host, url: String(request.preview_link).trim() });
  try {
    return { matches: await checkThreats({ db, settings, sites: [host], targets, urls, fetchImpl }), error: null };
  } catch (error) {
    return { matches: [], error: error.message };
  }
}
