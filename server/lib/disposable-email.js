const DEFAULT_DISPOSABLE_EMAIL_SOURCE_URL = 'https://raw.githubusercontent.com/eramitgupta/disposable-email/refs/heads/main/disposable_email.json';
const DISPOSABLE_EMAIL_CACHE_MS = 24 * 60 * 60 * 1000;
const DISPOSABLE_EMAIL_FETCH_TIMEOUT_MS = 5000;

const FALLBACK_DOMAINS = new Set([
  '10minutemail.com', 'dispostable.com', 'emailondeck.com', 'fakeinbox.com',
  'getnada.com', 'guerrillamail.com', 'guerrillamail.net', 'maildrop.cc',
  'mailinator.com', 'mintemail.com', 'mohmal.com', 'mytemp.email',
  'sharklasers.com', 'spam4.me', 'temp-mail.org', 'tempmail.com',
  'tempmail.net', 'tempail.com', 'throwawaymail.com', 'trashmail.com',
  'yopmail.com', 'yopmail.fr',
]);

let cachedSource = null;
let cachedDomains = FALLBACK_DOMAINS;
let cachedUntil = 0;
let pendingRefresh = null;

export function parseDisposableDomains(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  return new Set(items.map((item) => String(item).trim().toLowerCase().replace(/^@/, '')).filter(isValidDomain));
}

function isValidDomain(value) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value) && !value.includes('..') && !value.startsWith('.') && !value.endsWith('.');
}

function sourceUrl(settings = {}) {
  const value = String(settings.source_url || DEFAULT_DISPOSABLE_EMAIL_SOURCE_URL).trim();
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : DEFAULT_DISPOSABLE_EMAIL_SOURCE_URL;
  } catch {
    return DEFAULT_DISPOSABLE_EMAIL_SOURCE_URL;
  }
}

async function fetchDisposableDomains(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPOSABLE_EMAIL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Disposable email source returned ${response.status}`);
    const data = await response.json();
    const domains = parseDisposableDomains(data);
    if (domains.size === 0) throw new Error('Disposable email source returned no valid domains');
    return domains;
  } finally {
    clearTimeout(timer);
  }
}

async function disposableDomains(settings = {}) {
  const url = sourceUrl(settings);
  const now = Date.now();
  if (cachedSource === url && cachedUntil > now) return cachedDomains;
  pendingRefresh ||= fetchDisposableDomains(url)
    .then((domains) => {
      cachedSource = url;
      cachedDomains = domains;
      cachedUntil = Date.now() + DISPOSABLE_EMAIL_CACHE_MS;
      return domains;
    })
    .catch(() => {
      cachedSource = url;
      cachedDomains = cachedDomains?.size ? cachedDomains : FALLBACK_DOMAINS;
      cachedUntil = Date.now() + 5 * 60 * 1000;
      return cachedDomains;
    })
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
}

export async function disposableEmailResult(email, settings = {}) {
  if (!settings.enabled) return { disposable: false, domain: '' };
  const domain = String(email || '').trim().toLowerCase().split('@').pop() || '';
  const configured = parseDisposableDomains(settings.additional_domains);
  const sourceDomains = await disposableDomains(settings);
  return { disposable: sourceDomains.has(domain) || configured.has(domain), domain };
}

export const DISPOSABLE_EMAIL_SOURCE_URL = DEFAULT_DISPOSABLE_EMAIL_SOURCE_URL;
