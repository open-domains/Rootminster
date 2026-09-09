import { readCookieConsent } from './cookie-consent';

export const GOOGLE_ANALYTICS_ID = 'G-064HKW9S5K';
export const UMAMI_WEBSITE_ID = 'b2ad13e6-411c-454f-ae5f-b6f89f3e79c8';

let loading;

function addScript(id, attributes) {
  const existing = document.getElementById(id);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
    script.addEventListener('load', () => resolve(script), { once: true });
    script.addEventListener('error', () => reject(new Error(`Could not load ${attributes.src}`)), { once: true });
    document.head.appendChild(script);
  });
}

export function disableAnalytics() {
  if (typeof window === 'undefined') return;
  window[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = true;
  if (window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }
  document.cookie.split(';').map((part) => part.trim().split('=')[0]).filter((name) => name === '_ga' || name.startsWith('_ga_')).forEach((name) => {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.cookie = `${name}=; Path=/; Domain=.${window.location.hostname}; Max-Age=0; SameSite=Lax`;
  });
}

export function enableAnalytics() {
  if (typeof window === 'undefined' || !readCookieConsent()?.analytics) return Promise.resolve(false);
  if (loading) return loading;
  window[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_ANALYTICS_ID, { send_page_view: false, anonymize_ip: true });
  loading = Promise.all([
    addScript('rootminster-google-analytics', { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}` }),
    addScript('rootminster-umami-analytics', { defer: '', src: 'https://analytics.open-domains.com/script.js', 'data-website-id': UMAMI_WEBSITE_ID }),
  ]).then(() => true).catch((error) => {
    console.warn('Consent-enabled analytics could not start', error);
    return false;
  });
  return loading;
}

export function trackConsentPageView(path) {
  if (!readCookieConsent()?.analytics) return;
  enableAnalytics().then((enabled) => {
    if (!enabled || !window.gtag) return;
    window.gtag('event', 'page_view', {
      page_location: `${window.location.origin}${path}`,
      page_path: path,
      page_title: document.title,
    });
  });
}
