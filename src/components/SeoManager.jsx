import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveSeo } from '../../shared/seo.js';

function setMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
}

function setLink(rel, href, attrs = {}) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
}

export default function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const seo = resolveSeo(`${location.pathname}${location.search}`);
    document.title = seo.title;
    setMeta('meta[name="description"]', { name: 'description', content: seo.description });
    setMeta('meta[name="robots"]', { name: 'robots', content: seo.robots });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: seo.type });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: seo.canonical });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: seo.image });
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: seo.siteName });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: seo.image });
    setLink('canonical', seo.canonical);
    setLink('icon', '/open-domains-icon.png', { type: 'image/png' });
    setLink('apple-touch-icon', '/open-domains-icon.png');
  }, [location.pathname, location.search]);

  return null;
}
