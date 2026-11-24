import { randomToken, sha256 } from '../security.js';

// Abuse report triage: reports about the same host merge into one open report, every
// reporter gets a private status link, and reporters hear when the report is closed.

export const CLOSED_STATUSES = new Set(['resolved', 'dismissed']);
export const MAX_MERGED_REPORTS = 100;
const STATUS_LABELS = { open: 'Received', investigating: 'Under investigation', resolved: 'Closed: action taken', dismissed: 'Closed: no action needed' };

// Reporters paste a hostname or a full URL. Reduce both to the hostname so the same site
// reported two ways lands in the same report.
export function reportedHostname(value) {
  let text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(text)) text = `http://${text}`;
  try {
    return new URL(text).hostname.replace(/\.+$/, '');
  } catch {
    return String(value || '').trim().toLowerCase().split(/[/?#\s]/)[0].replace(/:\d+$/, '').replace(/\.+$/, '');
  }
}

export function isOpenReport(report) {
  return !CLOSED_STATUSES.has(String(report?.status || 'open'));
}

// A status token is "<report id>.<secret>". Only the secret's hash is stored on the report.
export function newReporterSecret() {
  const secret = randomToken(24);
  return { secret, hash: sha256(secret) };
}

export function statusToken(reportId, secret) {
  return `${reportId}.${secret}`;
}

export function parseStatusToken(value) {
  const match = String(value || '').match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{16,128})$/i);
  return match ? { reportId: match[1], secret: match[2] } : null;
}

export function reporterEntry({ email, tokenHash, now = new Date() }) {
  return { email: String(email || '').trim().slice(0, 254), token_hash: tokenHash, created_at: now.toISOString(), notified_status: null };
}

// Fields to write onto an existing open report when another report about the same host
// arrives. The first report's text stays as it was; later ones are kept alongside it.
export function mergedReportUpdate(existing, incoming, reporter, now = new Date()) {
  const merged = Array.isArray(existing.merged_reports) ? existing.merged_reports : [];
  const reporters = Array.isArray(existing.reporters) ? existing.reporters : [];
  const entry = {
    abuse_type: String(incoming.abuse_type || '').slice(0, 120),
    description: String(incoming.description || '').slice(0, 5000),
    evidence: String(incoming.evidence || '').slice(0, 5000),
    reporter_email: String(incoming.reporter_email || '').slice(0, 254),
    submitted_at: now.toISOString(),
  };
  return {
    merged_reports: [...merged, entry].slice(-MAX_MERGED_REPORTS),
    reporters: [...reporters, reporter].slice(-MAX_MERGED_REPORTS),
    report_count: Number(existing.report_count || 1) + 1,
    last_reported_at: now.toISOString(),
  };
}

export function findReporter(report, secret) {
  if (!secret || typeof secret !== 'string') return null;
  const hash = sha256(secret);
  return (Array.isArray(report?.reporters) ? report.reporters : []).find((item) => item.token_hash === hash) || null;
}

// What a reporter may see: the status only, never staff notes or other reporters.
export function publicReportStatus(report) {
  const status = String(report.status || 'open');
  return {
    subdomain: report.normalized_host || report.subdomain,
    abuse_type: report.abuse_type,
    status,
    status_label: STATUS_LABELS[status] || status,
    closed: CLOSED_STATUSES.has(status),
    submitted_at: report.created_date || null,
    updated_at: report.status_changed_at || report.updated_date || null,
  };
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

// Reporters with an email address who have not yet been told about this closed status.
export function reportersToNotify(report, status) {
  if (!CLOSED_STATUSES.has(status)) return [];
  return (Array.isArray(report.reporters) ? report.reporters : []).filter((item) => item.email && item.notified_status !== status);
}

export function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function shell(title, body) {
  return `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 20px;">
<div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
<h1 style="margin: 0 0 12px; font-size: 18px;">${title}</h1>${body}
<p style="margin: 24px 0 0; color: #64748b; font-size: 12px;">You are receiving this because you reported abuse to the Open Domains safety team.</p>
</div></body></html>`;
}

export function acknowledgementEmail({ host, statusUrl }) {
  const safeHost = escapeHtml(host);
  return {
    subject: `We received your abuse report about ${String(host).slice(0, 200)}`,
    body: shell('Thanks, we received your report', `<p style="font-size: 14px; line-height: 1.6;">Our safety team will review your report about <strong style="font-family: monospace;">${safeHost}</strong>, usually within 24 hours on business days.</p>
<p style="font-size: 14px; line-height: 1.6;">You can check its status at any time. Keep this link private.</p>
<p><a href="${escapeHtml(statusUrl)}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">View report status</a></p>`),
  };
}

export function closedEmail({ host, status, statusUrl }) {
  const safeHost = escapeHtml(host);
  return {
    subject: `Your abuse report about ${String(host).slice(0, 200)} is closed`,
    body: shell('Your report is closed', `<p style="font-size: 14px; line-height: 1.6;">The safety team has finished reviewing your report about <strong style="font-family: monospace;">${safeHost}</strong>.</p>
<p style="font-size: 14px; line-height: 1.6;">Status: <strong>${escapeHtml(statusLabel(status))}</strong></p>
${statusUrl ? `<p><a href="${escapeHtml(statusUrl)}" style="color: #4f46e5;">View report status</a></p>` : ''}`),
  };
}
