// Instant approval: approve low-risk subdomain requests without waiting for staff,
// then keep re-scanning the live hostname and pull it back to staff review if
// Observer later finds serious abuse. Every decision is written to the audit log.
//
// Decision data is stored on the request under `safety_auto_*` keys. The entity
// API hides `safety_*` fields from requesters, so they never see why a request
// was or wasn't approved instantly.
import { requestHostname, requestRecords } from '../../shared/subdomain-requests.js';
import { getModuleConfig } from '../module-settings.js';
import { scanObserverTarget } from '../observer.js';
import { store } from '../store.js';
import { cloudflareFetch } from './cloudflare.js';
import { provisionRequestBundle } from './request-approval.js';
import { withRequestLock } from './request-bundles.js';
import { notifyRequestApproved } from './request-notifications.js';
import { assessDeterministic } from './safety-screening.js';
import { syncOwnershipForNamespace } from './subdomain-ownership.js';

export const INSTANT_APPROVAL_ACTOR = Object.freeze({
  id: null,
  email: 'instant-approval@rootminster.local',
  role: 'system',
  full_name: 'Instant approval',
});

const SEVERITY_RANK = { clear: 0, info: 0, unknown: 0, low: 1, medium: 2, high: 3, critical: 4 };
const DAY_MS = 86_400_000;
const MAX_RECHECKS_PER_RUN = 25;

const severityRank = (value) => SEVERITY_RANK[String(value || '').toLowerCase()] ?? 0;

export function allowedRecordTypes(settings) {
  return new Set(String(settings.allowed_record_types || '')
    .split(/[\s,]+/)
    .map((type) => type.trim().toUpperCase())
    .filter(Boolean));
}

function startOfUtcDay(now) {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  return day.getTime();
}

// Pure decision. Returns { approve, reasons } where reasons explain the outcome to staff.
export function evaluateInstantApproval({
  settings,
  observerEnabled,
  observer,
  risk,
  request,
  user,
  history = [],
  approvedToday = 0,
  now = new Date(),
}) {
  const reasons = [];
  const nowMs = new Date(now).getTime();

  if (!observerEnabled) reasons.push('Observer is not enabled, so the preview could not be scanned.');
  else if (!observer || observer.error) reasons.push(`Observer scan did not complete${observer?.error ? `: ${observer.error}` : ''}.`);
  else if (observer.status !== 'clear') {
    reasons.push(`Observer flagged the preview (${observer.severity || 'unknown'} severity, ${observer.finding_count || 0} finding(s)).`);
  }

  const allowed = allowedRecordTypes(settings);
  const blockedTypes = [...new Set(requestRecords(request).map((record) => record.record_type))]
    .filter((type) => !allowed.has(type));
  if (blockedTypes.length) reasons.push(`Record type ${blockedTypes.join(', ')} always needs staff review.`);

  if (!risk) reasons.push('Account and request risk checks did not run.');
  else {
    const serious = (risk.signals || []).filter((item) => ['high', 'critical'].includes(item.severity));
    if (risk.verdict !== 'clear' || serious.length) {
      const labels = (serious.length ? serious : risk.signals || []).map((item) => item.label).slice(0, 4);
      reasons.push(`Risk checks scored ${risk.score}/100${labels.length ? ` (${labels.join('; ')})` : ''}.`);
    }
  }

  const created = Date.parse(user?.created_date || '');
  const minAge = Number(settings.min_account_age_days) || 0;
  if (minAge > 0 && (!Number.isFinite(created) || nowMs - created < minAge * DAY_MS)) {
    reasons.push(`Account is younger than ${minAge} day(s).`);
  }

  if (history.some((item) => item.safety_auto_decision === 'revoked')) {
    reasons.push('An earlier instant approval for this account was pulled back after Observer flagged it.');
  }
  const dayStart = startOfUtcDay(nowMs);
  const accountToday = history.filter((item) => item.safety_auto_decision === 'approved'
    && Date.parse(item.safety_auto_decided_at || '') >= dayStart).length;
  const perAccount = Number(settings.max_per_account_per_day) || 1;
  if (accountToday >= perAccount) reasons.push(`Account already used ${accountToday} instant approval(s) today (limit ${perAccount}).`);

  const perDay = Number(settings.max_per_day) || 1;
  if (approvedToday >= perDay) reasons.push(`Daily instant approval limit of ${perDay} reached.`);

  if (reasons.length) return { approve: false, reasons };
  return {
    approve: true,
    reasons: [
      'Observer found no issues with the preview.',
      `Risk checks scored ${risk.score}/100.`,
      `Record types: ${[...new Set(requestRecords(request).map((record) => record.record_type))].join(', ')}.`,
    ],
  };
}

async function riskAssessment(entities, request, user, storeImpl) {
  const [settings, byUser, targetMatches] = await Promise.all([
    entities.PlatformSettings.filter({ key: 'safety_protected_brands' }),
    entities.SubdomainRequest.filter({ requester_id: request.requester_id }, '-created_date', 500),
    storeImpl.requestsWithTargets(requestRecords(request).map((record) => record.record_value)),
  ]);
  return assessDeterministic(request, {
    protectedBrands: settings[0]?.value || '',
    recentRequests: byUser.filter((item) => item.id !== request.id),
    distinctTargetAccounts: new Set(targetMatches.map((item) => item.requester_id || item.requester_email).filter(Boolean)).size,
    user,
  });
}

async function audit(entities, action, request, description, extra = {}) {
  await entities.AuditLog.create({
    actor_email: INSTANT_APPROVAL_ACTOR.email,
    actor_role: 'system',
    action,
    entity_type: 'SubdomainRequest',
    entity_id: request.id,
    description,
    ...extra,
  }).catch(() => {});
}

// Called from submitRequest while the hostname's request lock is held.
// `observer` is the scan status submitRequest already recorded for this request.
export async function tryInstantApproval(platform, request, user, observer, deps = {}) {
  const settings = deps.settings || await getModuleConfig('instant_approval', { fresh: true });
  if (!settings.enabled) return { decision: 'disabled', reasons: [] };
  const entities = platform.asServiceRole.entities;
  const now = deps.now || new Date();
  const hostname = requestHostname(request);

  let decision;
  try {
    const observerSettings = deps.observerSettings || await getModuleConfig('observer', { fresh: true });
    const [risk, history, decidedRecently] = await Promise.all([
      riskAssessment(entities, request, user, deps.storeImpl || store),
      entities.SubdomainRequest.filter({ requester_id: request.requester_id, safety_auto_decision: { $in: ['approved', 'revoked'] } }, '-created_date', 500),
      entities.SubdomainRequest.filter({ safety_auto_decision: 'approved' }, '-created_date', 10000),
    ]);
    const dayStart = startOfUtcDay(now);
    decision = evaluateInstantApproval({
      settings,
      observerEnabled: Boolean(observerSettings.enabled),
      observer,
      risk,
      request,
      user,
      history: history.filter((item) => item.id !== request.id),
      approvedToday: decidedRecently.filter((item) => Date.parse(item.safety_auto_decided_at || '') >= dayStart).length,
      now,
    });
  } catch (error) {
    decision = { approve: false, reasons: [`Instant approval checks failed: ${error.message}`] };
  }

  const decidedAt = new Date(now).toISOString();
  if (!decision.approve) {
    await entities.SubdomainRequest.update(request.id, {
      safety_auto_decision: 'manual', safety_auto_reasons: decision.reasons, safety_auto_decided_at: decidedAt,
    });
    await audit(entities, 'instant_approval_declined', request, `Sent ${hostname} to staff review: ${decision.reasons.join(' ')}`);
    return { decision: 'manual', reasons: decision.reasons };
  }

  let provisioned;
  try {
    provisioned = await provisionRequestBundle(entities, request, INSTANT_APPROVAL_ACTOR,
      `Instantly approved. ${decision.reasons.join(' ')}`, deps.cfFetch || cloudflareFetch);
  } catch (error) {
    const reasons = [`DNS provisioning failed, so the request was left for staff: ${error.message}`];
    await entities.SubdomainRequest.update(request.id, {
      safety_auto_decision: 'failed', safety_auto_reasons: reasons, safety_auto_decided_at: decidedAt,
    });
    await audit(entities, 'instant_approval_failed', request, `Instant approval of ${hostname} failed: ${error.message}`);
    return { decision: 'failed', reasons };
  }

  const recheckMs = (Number(settings.recheck_minutes) || 30) * 60_000;
  const monitorMs = (Number(settings.monitoring_days) || 14) * DAY_MS;
  await entities.SubdomainRequest.update(request.id, {
    safety_auto_decision: 'approved',
    safety_auto_reasons: decision.reasons,
    safety_auto_decided_at: decidedAt,
    safety_auto_next_check_at: new Date(new Date(now).getTime() + recheckMs).toISOString(),
    safety_auto_monitor_until: new Date(new Date(now).getTime() + monitorMs).toISOString(),
  });
  await audit(entities, 'instant_approval_granted', request, `Instantly approved ${hostname}: ${decision.reasons.join(' ')}`);
  await notifyRequestApproved(platform, request, provisioned.bundle, INSTANT_APPROVAL_ACTOR.full_name, INSTANT_APPROVAL_ACTOR);
  return { decision: 'approved', reasons: decision.reasons, dnsRecords: provisioned.dnsRecords };
}

function pausedEmailHtml(hostname) {
  const safe = String(hostname).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  return `<p>Hi,</p><p>Your subdomain <strong>${safe}</strong> has been taken offline and returned to the review queue after an automated check of the live site.</p><p>A member of staff will review it and either restore it or contact you through the request conversation. You don't need to submit a new request.</p><p>Open Domains</p>`;
}

// Remove the hostname's live records and return the request to the staff queue.
// Callers hold the hostname's request lock.
export async function revokeInstantApproval(platform, request, { reason, actor = INSTANT_APPROVAL_ACTOR, cfFetch = cloudflareFetch, now = new Date() }) {
  const entities = platform.asServiceRole.entities;
  const hostname = requestHostname(request);
  const owned = (await entities.DnsRecord.filter({ name: hostname })).filter((record) =>
    record.owner_id ? record.owner_id === request.requester_id : record.owner_email === request.requester_email);

  const removed = [];
  for (const record of owned) {
    if (record.cloudflare_record_id && record.zone_id) {
      const response = await cfFetch('DELETE', `/zones/${record.zone_id}/dns_records/${record.cloudflare_record_id}`);
      if (!response.success && response._httpStatus !== 404) {
        throw Object.assign(new Error(`Cloudflare delete failed: ${response.errors?.[0]?.message || 'unknown error'}`), { status: 502 });
      }
    }
    await entities.DnsRecord.delete(record.id);
    removed.push({ id: record.id, record_type: record.record_type, content: record.content, ttl: record.ttl, proxied: record.proxied });
  }

  const records = requestRecords(request).map(({ cloudflare_record_id: _cf, dns_record_id: _dns, ...record }) => record);
  const stamp = new Date(now).toISOString();
  const note = `Pulled back to review ${stamp}: ${reason}`;
  await entities.SubdomainRequest.update(request.id, {
    status: 'pending',
    records,
    cloudflare_record_id: null,
    dns_record_id: null,
    reviewed_by: '',
    reviewed_at: null,
    admin_notes: [request.admin_notes, note].filter(Boolean).join('\n'),
    safety_auto_decision: 'revoked',
    safety_auto_reasons: [reason],
    safety_auto_revoked_at: stamp,
    safety_auto_next_check_at: null,
  });
  await syncOwnershipForNamespace(platform, {
    owner: { id: request.requester_id, email: request.requester_email },
    fullName: hostname,
    zone: { name: request.root_domain, zone_id: request.zone_id },
    now: new Date(now),
  });
  await entities.AuditLog.create({
    actor_email: actor.email,
    actor_role: actor.role || 'system',
    action: 'instant_approval_revoked',
    entity_type: 'SubdomainRequest',
    entity_id: request.id,
    description: `Pulled ${hostname} back to staff review and removed ${removed.length} DNS record(s): ${reason}`,
    old_value: JSON.stringify(removed),
  }).catch(() => {});

  try {
    await platform.asServiceRole.integrations.Core.SendEmail({
      to: request.requester_email,
      subject: `Your subdomain ${hostname} is under review`,
      body: pausedEmailHtml(hostname),
    });
  } catch { /* the request is already back in the staff queue */ }
  try {
    const settings = await entities.PlatformSettings.filter({ key: 'discord_webhook_url' });
    const webhook = settings?.[0]?.value;
    if (webhook) {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [{
          title: 'Instant approval pulled back',
          color: 0xef4444,
          fields: [
            { name: 'Subdomain', value: hostname, inline: true },
            { name: 'User', value: String(request.requester_email), inline: true },
            { name: 'By', value: String(actor.full_name || actor.email), inline: true },
            { name: 'Reason', value: String(reason).slice(0, 1000) },
          ],
          timestamp: stamp,
          footer: { text: 'Open Domains Platform' },
        }] }),
      });
    }
  } catch { /* notification only */ }
  return { removed };
}

// Scheduled re-scan of instantly approved hostnames during their monitoring period.
export async function recheckInstantApprovals(platform, deps = {}) {
  const entities = platform.asServiceRole.entities;
  const now = deps.now || new Date();
  const nowMs = new Date(now).getTime();
  const settings = deps.settings || await getModuleConfig('instant_approval', { fresh: true });
  const scan = deps.scan || scanObserverTarget;
  const threshold = severityRank(settings.revoke_severity || 'critical') || severityRank('critical');
  const retryMs = (Number(settings.recheck_minutes) || 30) * 60_000;

  const approved = await entities.SubdomainRequest.filter({ safety_auto_decision: 'approved', status: 'approved' }, '-created_date', 10000);
  const due = approved
    .filter((item) => Date.parse(item.safety_auto_monitor_until || '') > nowMs)
    .filter((item) => item.safety_auto_next_check_at && Date.parse(item.safety_auto_next_check_at) <= nowMs)
    .sort((a, b) => Date.parse(a.safety_auto_next_check_at) - Date.parse(b.safety_auto_next_check_at))
    .slice(0, deps.limit || MAX_RECHECKS_PER_RUN);

  const summary = { checked: 0, clear: 0, revoked: 0, failed: 0 };
  for (const item of due) {
    const hostname = requestHostname(item);
    await withRequestLock(hostname, async () => {
      const current = await entities.SubdomainRequest.get(item.id);
      if (!current || current.status !== 'approved' || current.safety_auto_decision !== 'approved') return;
      summary.checked++;
      let result;
      try {
        result = await scan({ full_name: hostname, url: `https://${hostname}` });
        if (result?.skipped) throw new Error(`scan skipped (${result.reason || 'unavailable'})`);
      } catch (error) {
        summary.failed++;
        await entities.SubdomainRequest.update(current.id, {
          safety_auto_next_check_at: new Date(nowMs + retryMs).toISOString(),
          safety_auto_last_check_at: new Date(nowMs).toISOString(),
          safety_auto_last_check_result: `error: ${error.message}`.slice(0, 500),
        });
        return;
      }
      const policy = result?.policy_result || result?.policy || {};
      const findings = Array.isArray(result?.findings) ? result.findings : Array.isArray(policy.findings) ? policy.findings : [];
      const severity = String(result?.severity || policy.severity || (findings.length ? 'unknown' : 'clear')).toLowerCase();
      if (findings.length && severityRank(severity) >= threshold) {
        const reason = `Observer re-scan of the live site found ${severity} severity issues: ${findings.map((finding) => finding.policy_section || finding.finding_type).filter(Boolean).join(', ') || 'policy finding'}.`;
        try {
          await revokeInstantApproval(platform, current, { reason, cfFetch: deps.cfFetch, now });
          summary.revoked++;
        } catch (error) {
          summary.failed++;
          await audit(entities, 'instant_approval_revoke_failed', current, `Could not pull ${hostname} back to review: ${error.message}`);
          await entities.SubdomainRequest.update(current.id, { safety_auto_next_check_at: new Date(nowMs + retryMs).toISOString() });
        }
        return;
      }
      summary.clear++;
      await entities.SubdomainRequest.update(current.id, {
        safety_auto_next_check_at: new Date(nowMs + DAY_MS).toISOString(),
        safety_auto_last_check_at: new Date(nowMs).toISOString(),
        safety_auto_last_check_result: findings.length ? `${severity} (below pull-back threshold)` : 'clear',
      });
    });
  }
  return summary;
}
