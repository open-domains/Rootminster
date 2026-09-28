import test from 'node:test';
import assert from 'node:assert/strict';
import { SEO_ROUTES, publicSitemapEntries, resolveSeo } from '../shared/seo.js';

const PUBLIC_ROUTES = [
  '/', '/how-it-works', '/faq', '/about', '/contact', '/privacy-policy', '/cookie-policy',
  '/terms-of-service', '/report-abuse', '/rdap', '/api-docs', '/guides', '/blog',
];

test('public pages have complete unique social metadata', () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const route of PUBLIC_ROUTES) {
    const seo = resolveSeo(route, 'https://open-domains.com');
    assert.match(seo.title, /OpenDomains/);
    assert.ok(seo.description.length >= 80, `${route} has a thin description`);
    assert.match(seo.canonical, /^https:\/\/open-domains\.com\//);
    assert.match(seo.image, /^https:\/\/open-domains\.com\//);
    assert.equal(seo.robots, 'index, follow');
    assert.equal(titles.has(seo.title), false, `${route} repeats title ${seo.title}`);
    assert.equal(descriptions.has(seo.description), false, `${route} repeats description`);
    titles.add(seo.title);
    descriptions.add(seo.description);
  }
});

test('private routes are noindexed but still have social metadata', () => {
  for (const route of ['/login', '/register', '/settings', '/admin-dashboard']) {
    const seo = resolveSeo(route, 'https://open-domains.com');
    assert.equal(seo.robots, 'noindex, nofollow');
    assert.ok(seo.title.includes('OpenDomains'));
    assert.ok(seo.description.length >= 40);
    assert.match(seo.canonical, /^https:\/\/open-domains\.com\//);
    assert.match(seo.image, /social-preview\.png$/);
  }
});

test('sitemap excludes private and noindex routes', () => {
  const entries = publicSitemapEntries('https://open-domains.com');
  const urls = entries.map((entry) => entry.loc);
  assert.ok(urls.includes('https://open-domains.com/'));
  assert.ok(urls.includes('https://open-domains.com/guides'));
  assert.equal(urls.some((url) => url.includes('/login')), false);
  assert.equal(urls.some((url) => url.includes('/admin-dashboard')), false);
});

test('metadata registry does not point at preview domains', () => {
  const serialized = JSON.stringify(SEO_ROUTES);
  assert.doesNotMatch(serialized, /vercel\.app|netlify\.app|pages\.dev|localhost|preview|verso/i);
});
