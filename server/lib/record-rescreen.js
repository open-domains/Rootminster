import { checkThreats, normalHost, recordTargetHost } from './threat-intel.js';

// Re-screening of DNS changes after approval. Approval checked the original target; a
// later edit could point the same name somewhere else entirely, so changes to where a
// record points go through the same kind of checks, and risky ones wait for staff.

export const HOLD_SCORE = 30;
// Sources that change targets by design and are already narrowly scoped.
const EXEMPT_SOURCES = new Set(['dynamic-dns', 'acme']);
const TARGET_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'NS', 'SRV']);

function signal(code, label, score, severity, evidence = '') {
  return { code, label, score, severity, evidence: String(evidence || '').slice(0, 500) };
}

export function shouldRescreen({ user, action, old = null, candidate }) {
  if (!user || ['admin', 'staff'].includes(user.role)) return false;
  if (EXEMPT_SOURCES.has(user.trusted_source)) return false;
  if (!TARGET_TYPES.has(String(candidate.record_type || '').toUpperCase())) return false;
  if (action === 'create') return true;
  if (action !== 'update' || !old) return false;
  const sameType = String(old.record_type || '').toUpperCase() === String(candidate.record_type || '').toUpperCase();
  const sameContent = String(old.content || '').trim().toLowerCase() === String(candidate.content || '').trim().toLowerCase();
  return !(sameType && sameContent);
}

// Pure scoring, so it can be tested without a database.
// The request-time "shared target" signal is left out on purpose: popular hosts such as
// Vercel or GitHub Pages share targets across thousands of accounts, and the name and
// preview-link signals do not change when a record is edited.
export function assessRecordChange({ candidate, user, threatMatches = [], now = Date.now() }) {
  const signals = [];
  for (const match of threatMatches) signals.push(signal('threat_feed_match', 'Target is on a threat list', 70, 'critical', match.detail));
  const created = new Date(user?.created_date || 0).getTime();
  const ageDays = created ? (now - created) / 86_400_000 : null;
  if (ageDays !== null && ageDays < 7 && ['MX', 'NS'].includes(String(candidate.record_type).toUpperCase())) {
    signals.push(signal('new_account_sensitive_record', 'New account changed a sensitive DNS record type', 18, 'medium', candidate.record_type));
  }
  if (ageDays !== null && ageDays < 7) signals.push(signal('new_account', 'Account is less than seven days old', 10, 'low', `${Math.floor(ageDays)} day(s)`));
  const score = Math.min(signals.reduce((total, item) => total + item.score, 0), 100);
  return { hold: score >= HOLD_SCORE, score, signals };
}

// Gathers the inputs and scores a change. Lookup failures count as no signal: a broken
// feed or database read should not freeze every DNS edit on the platform.
export async function screenRecordChange({ db, settings, user, candidate, siteHost, fetchImpl }) {
  const target = recordTargetHost(candidate.record_type, candidate.content);
  let threatMatches = [];
  if (settings?.enabled && target) {
    threatMatches = await checkThreats({ db, settings, sites: [], targets: [{ host: normalHost(siteHost || candidate.name), target }], fetchImpl }).catch(() => []);
  }
  return assessRecordChange({ candidate, user, threatMatches });
}

export function heldChangeMessage(assessment) {
  const reasons = assessment.signals.filter((item) => item.score >= 18).map((item) => item.label.toLowerCase());
  return `This DNS change was sent to staff for review${reasons.length ? ` (${reasons.join('; ')})` : ''}. It has not been applied yet. You will get an email when it is reviewed.`;
}
