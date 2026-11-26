import { AccountApi, Configuration, SendApi } from 'hostinger-mail-api-sdk';

// Hostinger Mail API delivery handler. Uses the official SDK
// (https://github.com/hostinger/mail-api-typescript-sdk): a bearer token scoped
// to a Hostinger email order, and the resource ID of the mailbox to send from.
// The API sends as that mailbox, so the From address is always the mailbox
// address; only the display name can be changed.

const TIMEOUT_MS = 15_000;
const emailPattern = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

let clientKey;
let client;

export function createHostingerMailClient(settings) {
  const configuration = new Configuration({ accessToken: settings.api_token, baseOptions: { timeout: TIMEOUT_MS } });
  return { account: new AccountApi(configuration), send: new SendApi(configuration) };
}

function clientFor(settings) {
  const key = settings.api_token;
  if (key !== clientKey || !client) {
    client = createHostingerMailClient(settings);
    clientKey = key;
  }
  return client;
}

// Accepts the shapes the rest of the server passes to sendEmail(): one address,
// a comma/semicolon separated list, "Name <address>" entries, or an array.
export function normaliseRecipients(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(/[,;]/);
  const recipients = [];
  for (const item of items) {
    const raw = String(item ?? '').trim();
    if (!raw) continue;
    const address = (raw.match(/<([^<>]+)>\s*$/)?.[1] || raw).trim().toLowerCase();
    if (!emailPattern.test(address)) throw Object.assign(new Error(`Invalid recipient address: ${address.slice(0, 200)}`), { status: 400 });
    if (!recipients.includes(address)) recipients.push(address);
  }
  return recipients;
}

// Turns an SDK (axios) error into a short message. Never pass the raw error
// on: its config carries the Authorization header.
export function describeHostingerMailError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  if (!status) {
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'Hostinger Mail API did not respond in time';
    return `Hostinger Mail API request failed: ${String(error?.message || 'network error').slice(0, 200)}`;
  }
  const detail = [data?.message, data?.error].find((part) => typeof part === 'string' && part.trim());
  const params = data?.params && typeof data.params === 'object'
    ? Object.entries(data.params).map(([field, messages]) => `${field}: ${[].concat(messages).join(', ')}`).join('; ')
    : '';
  const reason = { 401: 'the API token is missing or invalid', 403: 'the API token cannot manage this mailbox', 422: 'the message failed validation' }[status];
  return `Hostinger Mail API returned ${status}${reason ? ` (${reason})` : ''}${detail ? `: ${detail}` : ''}${params ? ` [${params}]` : ''}`.slice(0, 500);
}

function wrap(error) {
  const status = error?.response?.status;
  return Object.assign(new Error(describeHostingerMailError(error)), { status: status === 422 ? 400 : 502, providerStatus: status });
}

export function displayNameFor(settings, smtpFrom = '') {
  if (settings.display_name) return settings.display_name;
  // Reuse the name part of the SMTP "From" setting, e.g. "Open Domains <no-reply@…>".
  const name = String(smtpFrom).match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  return name || undefined;
}

export async function sendHostingerMail(settings, { to, subject, body, text, displayName }, { mailClient = clientFor(settings) } = {}) {
  const recipients = normaliseRecipients(to);
  if (!recipients.length) throw Object.assign(new Error('Email has no recipients'), { status: 400 });
  const html = body ? String(body) : undefined;
  const request = {
    to: recipients,
    subject: String(subject ?? '').slice(0, 998),
    html,
    text: text || (html ? html.replace(/<[^>]*>/g, ' ') : undefined),
    ...(displayName ? { displayName } : {}),
  };
  try {
    await mailClient.send.sendEmail(settings.mailbox_resource_id, request);
  } catch (error) {
    throw wrap(error);
  }
  // 204: accepted for delivery. Hostinger does not report later bounces here.
  return { accepted: recipients, provider: 'hostinger_mail' };
}

// Checks the token and resolves the mailbox to send from. When no mailbox ID
// is configured and the token manages exactly one mailbox, that one is used.
export async function resolveHostingerMailbox(settings, { mailClient = createHostingerMailClient(settings) } = {}) {
  let mailboxes;
  try {
    const { data } = await mailClient.account.getCurrentAccount();
    mailboxes = data?.data?.mailboxes || [];
  } catch (error) {
    throw wrap(error);
  }
  const wanted = String(settings.mailbox_resource_id || '').trim();
  if (wanted) {
    const match = mailboxes.find((mailbox) => mailbox.resourceId === wanted);
    if (!match) throw Object.assign(new Error(`This API token cannot manage mailbox ${wanted}. Available: ${mailboxes.map((m) => `${m.address} (${m.resourceId})`).join(', ') || 'none'}`), { status: 400 });
    return match;
  }
  if (mailboxes.length === 1) return mailboxes[0];
  if (!mailboxes.length) throw Object.assign(new Error('This API token cannot manage any mailboxes'), { status: 400 });
  throw Object.assign(new Error(`This API token manages several mailboxes. Set the mailbox resource ID to one of: ${mailboxes.map((m) => `${m.address} (${m.resourceId})`).join(', ')}`), { status: 400 });
}
