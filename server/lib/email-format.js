import { escapeHtml } from './html.js';

// Helpers that turn the HTML fragments the server writes into complete,
// deliverable emails: a full HTML document with a simple branded layout, and a
// readable plain-text alternative. A bare HTML fragment with a text part made
// by stripping tags (links lost, everything on one line) is a common spam
// signal, so every message sendEmail() delivers goes through here.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

function decodeEntities(value) {
  return value.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name) => ENTITIES[name]);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '');
}

export function isHtmlDocument(html) {
  return /^\s*(<!doctype\s+html|<html[\s>])/i.test(String(html || ''));
}

// Plain-text version of an email body. Links keep their address, paragraphs,
// list items and line breaks keep their shape, and hidden preheader text is
// left out.
export function htmlToText(html) {
  let text = String(html || '');
  text = text.replace(/<(head|style|script|title)\b[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/<([a-z0-9]+)\b[^>]*data-email-hidden[^>]*>[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_, _quote, href, inner) => {
    const label = decodeEntities(stripTags(inner)).replace(/\s+/g, ' ').trim();
    const url = decodeEntities(href).trim();
    if (!url || url.startsWith('#')) return label;
    if (!label || label === url || label === url.replace(/^mailto:/i, '')) return url.replace(/^mailto:/i, '');
    return `${label}: ${url}`;
  });
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li\b[^>]*>/gi, '\n- ');
  text = text.replace(/<\/(p|div|h[1-6]|ul|ol|table|tr|blockquote)>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '');
  text = text.replace(/<\/td>/gi, ' ');
  text = decodeEntities(stripTags(text));
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Wraps an HTML fragment in a complete email document with a branded header
// and a footer. `preheader` is the short summary inboxes show next to the
// subject; it is hidden in the message itself.
export function emailDocument({ bodyHtml, subject = '', platformName = 'Open Domains', appUrl = '', preheader = '', footer = '' }) {
  const platform = escapeHtml(platformName);
  const home = appUrl ? `<a href="${escapeHtml(appUrl)}" style="color:#6b7280;text-decoration:underline">${escapeHtml(appUrl.replace(/^https?:\/\//, ''))}</a>` : '';
  const footerText = footer || `This email was sent by ${platform} about your account.`;
  const hiddenPreheader = preheader
    ? `<div data-email-hidden style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;opacity:0">${escapeHtml(preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(subject || platformName)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7">
${hiddenPreheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#111827">${platform}</td></tr>
<tr><td style="padding:24px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">
${bodyHtml}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:16px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">
<p style="margin:0 0 4px">${footerText}</p>
${home ? `<p style="margin:0">${home}</p>` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Builds the html and text parts sendEmail() delivers. A fragment is wrapped in
// the layout; a body that is already a full document is left as it is. The
// text part is the caller's own text when given, otherwise derived from the
// fragment (not the layout) so it reads as the message itself.
export function buildEmailParts({ subject, body, text, preheader, footer, platformName, appUrl }) {
  const html = String(body || '');
  if (!html) return { html: undefined, text: text || undefined };
  const wrapped = isHtmlDocument(html) ? html : emailDocument({ bodyHtml: html, subject, platformName, appUrl, preheader, footer });
  const plain = text || htmlToText(html);
  const signature = isHtmlDocument(html) ? '' : `\n\n--\n${platformName}${appUrl ? `\n${appUrl}` : ''}`;
  return { html: wrapped, text: text ? text : `${plain}${signature}` };
}
