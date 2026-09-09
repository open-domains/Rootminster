export const COOKIE_CONSENT_NAME = 'rootminster_cookie_consent';
export const COOKIE_CONSENT_VERSION = '2026-09-09';
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

export function parseConsentValue(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (parsed?.version !== COOKIE_CONSENT_VERSION || typeof parsed.analytics !== 'boolean') return null;
    return { version: parsed.version, analytics: parsed.analytics, updated_at: parsed.updated_at || null };
  } catch {
    return null;
  }
}

export function serializeConsentValue({ analytics }, updatedAt = new Date().toISOString()) {
  return encodeURIComponent(JSON.stringify({ version: COOKIE_CONSENT_VERSION, analytics: Boolean(analytics), updated_at: updatedAt }));
}

export function readCookieConsent() {
  if (typeof document === 'undefined') return null;
  const prefix = `${COOKIE_CONSENT_NAME}=`;
  const value = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return parseConsentValue(value?.slice(prefix.length));
}

export function saveCookieConsent(preferences) {
  if (typeof document === 'undefined') return null;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const value = serializeConsentValue(preferences);
  document.cookie = `${COOKIE_CONSENT_NAME}=${value}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
  const saved = readCookieConsent();
  window.dispatchEvent(new CustomEvent('rootminster:cookie-consent', { detail: saved }));
  return saved;
}

export function openCookieSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rootminster:open-cookie-settings'));
}
