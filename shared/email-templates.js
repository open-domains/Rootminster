// Every email Rootminster sends to people, written to look like plain service
// mail rather than marketing:
//
// - Bodies are HTML fragments. The server's sendEmail() wraps them in one
//   simple branded layout and adds a plain-text part with the links written
//   out, so no template builds its own <html> document.
// - Subjects are short sentence case: no emoji, no ALL CAPS, no "!".
// - No gradients, dark backgrounds, badges or emoji in the body.
// - Every link points at the site's own address (appUrl), never a hard-coded
//   or third-party domain, and every button has its address written out below.
// - Anything a user, visitor or staff member typed is escaped. Names are left
//   out, so a name typed at sign-up cannot carry text into someone's inbox.
//
// Each function returns { subject, preheader, body }. `preheader` is the short
// summary inboxes show next to the subject.
//
// This file has no imports so both the server and the admin UI can use it.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const BRAND = '#6d5dfc';
const MUTED = '#6b7280';

export function escapeEmailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

const esc = escapeEmailHtml;

function oneLine(value, max = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function siteUrl(appUrl, path = '') {
  const base = String(appUrl || '').replace(/\/+$/, '');
  return `${base}${path}`;
}

export function paragraph(html, style = '') {
  return `<p style="margin:0 0 16px${style ? `;${style}` : ''}">${html}</p>`;
}

// A button followed by its address in plain text, so the link is readable in
// clients that hide buttons and the visible address matches the real one.
export function button(url, label) {
  const href = esc(url);
  return paragraph(`<a href="${href}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600">${esc(label)}</a>`)
    + paragraph(`If the button does not work, copy this address into your browser:<br><a href="${href}" style="color:${BRAND};word-break:break-all">${href}</a>`, `font-size:13px;color:${MUTED}`);
}

export function code(value) {
  return `<code style="font-family:Menlo,Consolas,monospace;font-size:14px;background:#f3f4f6;padding:1px 5px;border-radius:4px">${esc(value)}</code>`;
}

// Label/value rows. Values are escaped and shown in monospace.
export function details(rows) {
  const body = rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<tr><td style="padding:4px 16px 4px 0;color:${MUTED};vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:4px 0;font-family:Menlo,Consolas,monospace;font-size:14px;word-break:break-all">${esc(value)}</td></tr>`)
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-collapse:collapse">${body}</table>`;
}

// Text someone wrote (a staff question, a reviewer note), set off from the
// rest of the message. Escaped, with line breaks kept.
export function quote(label, text) {
  const safe = esc(String(text ?? '').slice(0, 5000)).replace(/\r?\n/g, '<br>');
  return `<div style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #d1d5db;background:#f9fafb">`
    + `<p style="margin:0 0 4px;font-size:13px;color:${MUTED}">${esc(label)}</p>`
    + `<p style="margin:0">${safe}</p></div>`;
}

function platformOf(platform) {
  return oneLine(platform || 'Open Domains', 80) || 'Open Domains';
}

// Accounts

export function verificationEmail({ platform, verificationUrl }) {
  const name = platformOf(platform);
  return {
    subject: `Confirm your email address for ${name}`,
    preheader: 'Confirm your address to finish creating your account.',
    body: paragraph('Hi,')
      + paragraph(`Confirm your email address to finish creating your ${esc(name)} account.`)
      + button(verificationUrl, 'Confirm email address')
      + paragraph('This link works once and expires in 24 hours.')
      + paragraph('If you did not create an account, you can ignore this email. No account is created until the address is confirmed.', `color:${MUTED}`),
  };
}

export function passwordResetEmail({ platform, resetUrl }) {
  const name = platformOf(platform);
  return {
    subject: `Reset your ${name} password`,
    preheader: 'This link expires in one hour.',
    body: paragraph('Hi,')
      + paragraph(`Someone asked to reset the password for your ${esc(name)} account. Use the button below to choose a new one.`)
      + button(resetUrl, 'Choose a new password')
      + paragraph('This link works once and expires in one hour.')
      + paragraph('If you did not ask for this, you can ignore this email. Your password stays the same.', `color:${MUTED}`),
  };
}

export function accountDeletionOutcomeEmail({ platform, approved, reason }) {
  const name = platformOf(platform);
  if (approved) {
    return {
      subject: `Your ${name} account has been deleted`,
      preheader: 'Your account deletion request was approved.',
      body: paragraph('Hi,')
        + paragraph(`Your account deletion request was approved. Your ${esc(name)} account and the data it managed have been permanently deleted.`)
        + paragraph('If you did not expect this, please contact support.', `color:${MUTED}`),
    };
  }
  return {
    subject: `Update on your ${name} account deletion request`,
    preheader: 'Your account deletion request was not approved.',
    body: paragraph('Hi,')
      + paragraph('Your account deletion request was reviewed and was not approved. Your account is still active.')
      + (reason ? quote('Reason', reason) : '')
      + paragraph('You can contact support if you have questions.', `color:${MUTED}`),
  };
}

export function migrationCodeEmail({ platform, oldEmail, code: verificationCode }) {
  const name = platformOf(platform);
  return {
    subject: `Your ${name} verification code`,
    preheader: 'Use this code to finish moving your domains. It expires in 15 minutes.',
    body: paragraph('Hi,')
      + paragraph(`You asked to move the domains registered under ${code(oldEmail)} to your ${esc(name)} account. Enter this code to continue:`)
      + paragraph(`<span style="font-family:Menlo,Consolas,monospace;font-size:24px;font-weight:700;letter-spacing:3px">${esc(verificationCode)}</span>`)
      + paragraph('The code expires in 15 minutes.')
      + paragraph('If you did not ask for this, you can ignore this email.', `color:${MUTED}`),
  };
}

export function domainsMigratedEmail({ platform, appUrl, domains = [] }) {
  const name = platformOf(platform);
  const count = domains.length;
  const list = domains
    .map((domain) => `<li style="margin:0 0 4px">${code(domain.full_name)} (${esc(domain.type)})</li>`)
    .join('');
  return {
    subject: `${count} domain record${count === 1 ? '' : 's'} moved to your ${name} account`,
    preheader: 'Your GitHub-registered domains are now in your account.',
    body: paragraph('Hi,')
      + paragraph(`Your GitHub-registered domains have been moved to your ${esc(name)} account. These records are now managed there:`)
      + `<ul style="margin:0 0 16px;padding-left:20px">${list}</ul>`
      + button(siteUrl(appUrl, '/my-subdomains'), 'View my subdomains'),
  };
}

export function legacyDonorEmail({ platform, appUrl, fromMigration = false }) {
  const name = platformOf(platform);
  const why = fromMigration
    ? 'Your migrated domains include nameserver (NS) records, so your account has been marked as a legacy donor.'
    : 'Thank you for supporting the project in the past. Your account has been marked as a legacy donor.';
  return {
    subject: `Legacy donor status added to your ${name} account`,
    preheader: 'NS records are now available when you request subdomains.',
    body: paragraph('Hi,')
      + paragraph(esc(why))
      + paragraph('This means:')
      + '<ul style="margin:0 0 16px;padding-left:20px">'
      + '<li style="margin:0 0 4px">You can use the NS (nameserver) record type when requesting subdomains.</li>'
      + '<li style="margin:0 0 4px">Your account shows a legacy donor badge.</li>'
      + '</ul>'
      + button(siteUrl(appUrl, '/user-dashboard'), 'Open my dashboard'),
  };
}

// Subdomain requests

export function requestApprovedEmail({ platform, appUrl, hostname, recordType, recordValue }) {
  const name = platformOf(platform);
  return {
    subject: `Your subdomain ${oneLine(hostname, 255)} is approved`,
    preheader: 'Your DNS record is now live.',
    body: paragraph('Hi,')
      + paragraph(`Your request for ${code(hostname)} was approved and its DNS record is now live.`)
      + details([['Subdomain', hostname], ['Type', recordType], ['Value', recordValue]])
      + paragraph(`You can manage it from your ${esc(name)} dashboard. Later changes to this subdomain are reviewed by staff before they go live.`)
      + button(siteUrl(appUrl, '/my-subdomains'), 'View my subdomains'),
  };
}

export function requestRejectedEmail({ platform, appUrl, hostname, reason, reviewerName }) {
  return {
    subject: `Update on your request for ${oneLine(hostname, 255)}`,
    preheader: 'Your subdomain request was not approved.',
    body: paragraph('Hi,')
      + paragraph(`Your request for ${code(hostname)} was reviewed and was not approved.`)
      + (reason ? quote('Reason', reason) : '')
      + paragraph('You can send a new request with updated details, or reply in the request conversation if you have questions.')
      + (reviewerName ? paragraph(`Reviewed by ${esc(oneLine(reviewerName, 80))}`, `font-size:13px;color:${MUTED}`) : '')
      + button(siteUrl(appUrl, '/my-subdomains'), 'View my requests'),
  };
}

export function requestQuestionEmail({ platform, appUrl, hostname, question }) {
  const name = platformOf(platform);
  return {
    subject: `Question about your request for ${oneLine(hostname, 255)}`,
    preheader: 'Our review team needs more information before continuing.',
    body: paragraph('Hi,')
      + paragraph(`Our review team has a question about your request for ${code(hostname)} before they can continue.`)
      + quote(`From ${name} staff`, question)
      + paragraph('Sign in and reply in the request conversation to continue the review.')
      + button(siteUrl(appUrl, '/my-subdomains'), 'Reply to the question'),
  };
}

export function requestPausedEmail({ appUrl, hostname }) {
  return {
    subject: `Your subdomain ${oneLine(hostname, 255)} is back in review`,
    preheader: 'An automated check took it offline until staff review it.',
    body: paragraph('Hi,')
      + paragraph(`Your subdomain ${code(hostname)} has been taken offline and returned to the review queue after an automated check of the live site.`)
      + paragraph('A member of staff will review it and either restore it or contact you in the request conversation. You do not need to send a new request.')
      + button(siteUrl(appUrl, '/my-subdomains'), 'View my requests'),
  };
}

export function heldDnsChangeEmail({ appUrl, hostname, recordType, content, approved, note }) {
  return {
    subject: approved ? `Your DNS change for ${oneLine(hostname, 255)} is live` : `Your DNS change for ${oneLine(hostname, 255)} was not applied`,
    preheader: approved ? 'Staff approved your DNS change.' : 'Staff reviewed your DNS change and did not apply it.',
    body: paragraph('Hi,')
      + paragraph(approved ? 'Staff approved your DNS change and it is now live:' : 'Staff reviewed your DNS change and did not apply it:')
      + details([['Name', hostname], ['Type', recordType], ['Value', content]])
      + (!approved && note ? quote('Reviewer note', note) : '')
      + button(siteUrl(appUrl, '/my-subdomains'), 'View my subdomains'),
  };
}

export function showcaseReviewEmail({ appUrl, hostname, approved, note }) {
  return {
    subject: approved ? `${oneLine(hostname, 255)} is now in the showcase` : `Your showcase listing for ${oneLine(hostname, 255)} was not approved`,
    preheader: approved ? 'Your project is listed in the public showcase.' : 'You can edit the listing and send it again.',
    body: paragraph('Hi,')
      + (approved
        ? paragraph(`Your project at ${code(hostname)} is now listed in the public showcase.`)
          + button(siteUrl(appUrl, '/showcase'), 'View the showcase')
        : paragraph(`Your showcase listing for ${code(hostname)} was not approved.`)
          + (note ? quote('Reviewer note', note) : '')
          + paragraph('You can edit the listing and send it again from the DNS manager.')
          + button(siteUrl(appUrl, '/my-subdomains'), 'Open the DNS manager')),
  };
}

// Staff alerts

export function abuseReportStaffEmail({ platform, appUrl, subdomain, abuseType, reporter, description, evidence }) {
  const name = platformOf(platform);
  return {
    subject: `New abuse report: ${oneLine(abuseType, 80)} on ${oneLine(subdomain, 200)}`,
    preheader: `Reported by ${oneLine(reporter || 'an anonymous visitor', 120)}.`,
    footer: `This alert was sent to all ${esc(name)} staff and admins.`,
    body: paragraph('A new abuse report needs review.')
      + details([['Subdomain', subdomain], ['Type', abuseType], ['Reporter', reporter || 'Anonymous']])
      + quote('Description', description)
      + (evidence ? quote('Evidence', evidence) : '')
      + button(siteUrl(appUrl, '/admin-abuse-reports'), 'Open abuse reports'),
  };
}
