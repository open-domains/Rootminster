import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { apiRateKey, bearerToken, parsePagination, registerPublicApiRoutes } from './public-api.js';

test('Bearer parsing is case-insensitive and rejects other schemes', () => {
  assert.equal(bearerToken('Bearer od_example'), 'od_example');
  assert.equal(bearerToken('bearer   od_example'), 'od_example');
  assert.equal(bearerToken('Basic abc'), null);
  assert.equal(bearerToken(''), null);
});

test('pagination applies safe defaults and bounds', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 25, skip: 0 });
  assert.deepEqual(parsePagination({ page: '3', limit: '50' }), { page: 3, limit: 50, skip: 100 });
  assert.deepEqual(parsePagination({ page: '-2', limit: '5000' }), { page: 1, limit: 100, skip: 0 });
});

test('authenticated rate limits use a token hash rather than the secret', () => {
  const request = { headers: { authorization: 'Bearer od_secret' }, ip: '192.0.2.1' };
  const key = apiRateKey(request);
  assert.match(key, /^token:[a-f0-9]{64}$/);
  assert.equal(key.includes('od_secret'), false);
  assert.equal(apiRateKey({ headers: {}, ip: '192.0.2.1' }), 'ip:192.0.2.1');
});

test('v1 publishes a machine-readable OpenAPI document with CORS and version headers', async () => {
  const app = Fastify();
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await registerPublicApiRoutes(app);
  const response = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['access-control-allow-origin'], '*');
  assert.equal(response.headers['x-api-version'], '1.0.0');
  assert.equal(response.json().openapi, '3.1.0');
  await app.close();
});

test('public v1 routes enforce their documented rate limit', async () => {
  const app = Fastify();
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await registerPublicApiRoutes(app);
  let response;
  for (let index = 0; index < 61; index += 1) {
    response = await app.inject({ method: 'GET', url: '/api/v1/openapi.json', remoteAddress: '192.0.2.44' });
  }
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['x-ratelimit-limit'], '60');
  assert.ok(response.headers['retry-after']);
  await app.close();
});
