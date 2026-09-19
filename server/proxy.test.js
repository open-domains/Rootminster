import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { CLOUDFLARE_PROXY_CIDRS, proxyTrust } from './config.js';

test('Cloudflare proxy mode trusts the Docker proxy and Cloudflare ranges', () => {
  const trusted = proxyTrust({ TRUST_CLOUDFLARE_PROXY: 'true' }, true);

  assert.ok(trusted.includes('172.16.0.0/12'));
  assert.ok(trusted.includes('::1/128'));
  assert.ok(trusted.includes(CLOUDFLARE_PROXY_CIDRS[0]));
});

test('explicit proxy CIDRs override proxy modes and legacy hop counts', () => {
  assert.deepEqual(proxyTrust({
    TRUST_PROXY_CIDRS: '127.0.0.1/32, 172.20.0.0/16',
    TRUST_CLOUDFLARE_PROXY: 'true',
    TRUST_PROXY_HOPS: '2',
  }, true), ['127.0.0.1/32', '172.20.0.0/16']);
});

test('Cloudflare proxy mode resolves the visitor without trusting a forged public hop', async () => {
  const app = Fastify({ trustProxy: proxyTrust({ TRUST_CLOUDFLARE_PROXY: 'true' }, true) });
  app.get('/', request => ({ ip: request.ip, ips: request.ips }));

  const proxied = await app.inject({
    method: 'GET',
    url: '/',
    remoteAddress: '172.20.0.2',
    headers: { 'x-forwarded-for': '203.0.113.25, 104.16.10.20' },
  });
  assert.deepEqual(proxied.json(), {
    ip: '203.0.113.25',
    ips: ['172.20.0.2', '104.16.10.20', '203.0.113.25'],
  });

  const forged = await app.inject({
    method: 'GET',
    url: '/',
    remoteAddress: '172.20.0.2',
    headers: { 'x-forwarded-for': '203.0.113.25, 198.51.100.10' },
  });
  assert.deepEqual(forged.json(), {
    ip: '198.51.100.10',
    ips: ['172.20.0.2', '198.51.100.10'],
  });

  await app.close();
});
