// Renders every email Rootminster sends into one HTML page for review:
//   node scripts/preview-emails.js [out.html]
// Each email is shown as the full document sendEmail() delivers, with its
// subject, preheader and plain-text part beside it.
import { writeFileSync } from 'node:fs';
import * as t from '../shared/email-templates.js';
import { acknowledgementEmail, closedEmail } from '../server/lib/abuse-reports.js';
import { inactivityEmail } from '../server/lib/inactive-accounts.js';
import { buildEmailParts } from '../server/lib/email-format.js';
import { contactEmailBody } from '../server/routes/contact-routes.js';

const platform = 'Open Domains';
const appUrl = 'https://open-domains.com';
const host = 'blog.example.com';

const emails = [
  ['Account', 'Confirm email address', t.verificationEmail({ platform, verificationUrl: `${appUrl}/verify-email?token=EXAMPLE` })],
  ['Account', 'Password reset', t.passwordResetEmail({ platform, resetUrl: `${appUrl}/reset-password?token=EXAMPLE` })],
  ['Account', 'Deletion approved', t.accountDeletionOutcomeEmail({ platform, approved: true })],
  ['Account', 'Deletion not approved', t.accountDeletionOutcomeEmail({ platform, approved: false, reason: 'You still own active subdomains. Delete them first, then ask again.' })],
  ['Account', 'Inactivity notice', inactivityEmail('notice', { platformName: platform, appUrl, closesAt: '2026-12-27T03:45:00Z', lastActivityAt: '2025-11-02T00:00:00Z' })],
  ['Account', 'Inactivity reminder', inactivityEmail('reminder', { platformName: platform, appUrl, closesAt: '2026-12-27T03:45:00Z' })],
  ['Account', 'Inactivity closed', inactivityEmail('closed', { platformName: platform, appUrl })],
  ['Migration', 'Verification code', t.migrationCodeEmail({ platform, oldEmail: 'old@example.com', code: '482913' })],
  ['Migration', 'Domains moved', t.domainsMigratedEmail({ platform, appUrl, domains: [{ full_name: 'blog.example.com', type: 'CNAME' }, { full_name: 'mail.example.com', type: 'MX' }] })],
  ['Migration', 'Legacy donor (migration)', t.legacyDonorEmail({ platform, appUrl, fromMigration: true })],
  ['Migration', 'Legacy donor (admin)', t.legacyDonorEmail({ platform, appUrl })],
  ['Requests', 'Approved', t.requestApprovedEmail({ platform, appUrl, hostname: host, recordType: 'CNAME', recordValue: 'example.github.io' })],
  ['Requests', 'Not approved', t.requestRejectedEmail({ platform, appUrl, hostname: host, reason: 'The site linked from this request is not ready yet.', reviewerName: 'Sam' })],
  ['Requests', 'Staff question', t.requestQuestionEmail({ platform, appUrl, hostname: host, question: 'What will this subdomain be used for?\nPlease add a short description.' })],
  ['Requests', 'Back in review', t.requestPausedEmail({ appUrl, hostname: host })],
  ['DNS', 'Held change live', t.heldDnsChangeEmail({ appUrl, hostname: host, recordType: 'A', content: '192.0.2.10', approved: true })],
  ['DNS', 'Held change not applied', t.heldDnsChangeEmail({ appUrl, hostname: host, recordType: 'TXT', content: 'v=spf1 -all', approved: false, note: 'This record would break mail for the parent domain.' })],
  ['Showcase', 'Listing approved', t.showcaseReviewEmail({ appUrl, hostname: host, approved: true })],
  ['Showcase', 'Listing not approved', t.showcaseReviewEmail({ appUrl, hostname: host, approved: false, note: 'Please add a screenshot.' })],
  ['Abuse', 'Report received', acknowledgementEmail({ host: 'bad.example.com', statusUrl: `${appUrl}/report-abuse/status/EXAMPLE` })],
  ['Abuse', 'Report closed', closedEmail({ host: 'bad.example.com', status: 'resolved', statusUrl: `${appUrl}/report-abuse/status/EXAMPLE` })],
  ['Staff', 'New abuse report', t.abuseReportStaffEmail({ platform, appUrl, subdomain: 'bad.example.com', abuseType: 'phishing', reporter: 'reporter@example.com', description: 'This page copies a bank login form.', evidence: 'https://bad.example.com/login' })],
  ['Staff', 'Contact form', { subject: '[Contact] Question about NS records', body: contactEmailBody({ name: 'Alex', email: 'alex@example.com', subject: 'Question about NS records', message: 'Can I point a subdomain at my own nameservers?' }) }],
];

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const cards = emails.map(([group, label, email], index) => {
  const parts = buildEmailParts({ ...email, platformName: platform, appUrl });
  return `<section id="e${index}">
  <h2><span>${esc(group)}</span> ${esc(label)}</h2>
  <dl><dt>Subject</dt><dd>${esc(email.subject)}</dd><dt>Preview text</dt><dd>${esc(email.preheader || '(none)')}</dd></dl>
  <div class="pair">
    <iframe title="${esc(label)} HTML" srcdoc="${esc(parts.html)}" loading="lazy"></iframe>
    <pre>${esc(parts.text)}</pre>
  </div>
</section>`;
}).join('\n');

const nav = emails.map(([group, label], index) => `<a href="#e${index}">${esc(group)}: ${esc(label)}</a>`).join('');

const page = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rootminster email previews</title>
<style>
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; color: #111827; background: #f9fafb; }
  header { padding: 24px 32px 8px; } header h1 { margin: 0 0 4px; font-size: 22px; } header p { margin: 0; color: #4b5563; max-width: 70ch; }
  nav { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 32px 20px; }
  nav a { font-size: 13px; padding: 3px 9px; border: 1px solid #d1d5db; border-radius: 999px; color: #374151; text-decoration: none; background: #fff; }
  section { margin: 0 32px 32px; padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; }
  h2 { margin: 0 0 8px; font-size: 17px; } h2 span { font-weight: 500; color: #6b7280; margin-right: 6px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0 0 12px; } dt { color: #6b7280; } dd { margin: 0; font-weight: 600; }
  .pair { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; }
  iframe { width: 100%; height: 620px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f4f5f7; }
  pre { margin: 0; padding: 12px; height: 596px; overflow: auto; white-space: pre-wrap; font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
  @media (max-width: 900px) { .pair { grid-template-columns: 1fr; } pre { height: auto; } }
</style></head><body>
<header><h1>Rootminster email previews</h1><p>Each email as it will be delivered: the HTML version on the left and the plain-text version on the right. ${emails.length} emails, sample data only.</p></header>
<nav>${nav}</nav>
${cards}
</body></html>`;

const out = process.argv[2] || 'email-previews.html';
writeFileSync(out, page);
console.log(`wrote ${emails.length} email previews to ${out}`);
