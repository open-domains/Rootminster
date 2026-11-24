// ACME DNS-01 challenge helpers. A `dns:acme` token may only publish TXT records at
// `_acme-challenge.<allowed hostname>`, and every record it creates expires after a day.

export const ACME_LABEL = '_acme-challenge';
export const ACME_TTL_SECONDS = 60;
export const ACME_CHALLENGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const VALUE_PATTERN = /^[A-Za-z0-9_-]{20,256}$/;
const HOST_PATTERN = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/;

function normal(value) {
  return String(value || '').trim().toLowerCase().replace(/\.+$/, '');
}

// Accepts "_acme-challenge.example.com." (lego, certbot, acme.sh all send this form) and
// returns the hostname the certificate is for, or null.
export function challengeBaseHostname(fqdn) {
  const name = normal(fqdn);
  const prefix = `${ACME_LABEL}.`;
  if (!name.startsWith(prefix) || name.length > 253) return null;
  const base = name.slice(prefix.length);
  if (!HOST_PATTERN.test(base) || base.split('.').some((label) => label.length > 63)) return null;
  return base;
}

export function challengeName(baseHostname) {
  return `${ACME_LABEL}.${normal(baseHostname)}`;
}

export function validChallengeValue(value) {
  return typeof value === 'string' && VALUE_PATTERN.test(value);
}

// lego's httpreq provider can only send HTTP Basic credentials, so the token may be
// supplied as the Basic password (the username is ignored) as well as a Bearer token.
export function acmeCredential(authorization = '') {
  const header = String(authorization || '');
  const bearer = header.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim() || null;
  const basic = header.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
  if (!basic) return null;
  const decoded = Buffer.from(basic[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  const password = separator === -1 ? '' : decoded.slice(separator + 1);
  return password.trim() || null;
}

export function challengeExpired(record, now = new Date()) {
  if (record?.acme_challenge !== true) return false;
  const expires = new Date(record.acme_expires_at || 0).getTime();
  return !Number.isFinite(expires) || expires <= now.getTime();
}

// Deletes expired challenge records through the normal DNS delete path, so Cloudflare,
// ownership state and the audit log stay consistent.
export async function cleanupExpiredAcmeChallenges({ store, deleteRecord, now = new Date() }) {
  const rows = await store.filter('DnsRecord', { acme_challenge: true }, 'created_date', 10_000);
  let deleted = 0;
  let failed = 0;
  for (const record of rows) {
    if (!challengeExpired(record, now)) continue;
    try {
      await deleteRecord(record);
      deleted++;
    } catch (error) {
      if (error?.status === 404) continue;
      failed++;
      console.error('[acme] could not remove expired challenge', record.name, error?.message || error);
    }
  }
  return { checked: rows.length, deleted, failed };
}
