import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');

const adminRoutePattern = /<Route\s+path="(\/admin-[^"]+|\/docker-engine)"/g;
const adminRoutes = [...appSource.matchAll(adminRoutePattern)].map(match => match[1]);
const redirects = new Set(['/admin-dns-records']);
const visibleAdminRoutes = adminRoutes.filter(route => !redirects.has(route));

test('all admin pages are reachable from the admin navigation', () => {
  const missing = visibleAdminRoutes.filter(route => !layoutSource.includes(`to: '${route}'`));
  assert.deepEqual(missing, []);
});

test('hidden operational admin pages are promoted into navigation with explicit labels', () => {
  for (const [route, label] of [
    ['/admin-domains', 'Root Domains'],
    ['/admin-donations', 'Donations'],
    ['/admin-email-logs', 'Email Logs'],
  ]) {
    assert.ok(layoutSource.includes(`to: '${route}'`), `${route} missing from admin nav`);
    assert.ok(layoutSource.includes(`label: '${label}'`), `${label} label missing from admin nav`);
  }
});
