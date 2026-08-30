import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import rawBody from 'fastify-raw-body';
import { assertProductionConfiguration, config } from './config.js';
import { pool } from './database.js';
import { registerAuthRoutes } from './auth.js';
import { registerEntityRoutes } from './entity-routes.js';
import { registerFunctionRoutes } from './function-runner.js';

assertProductionConfiguration();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  trustProxy: true,
  bodyLimit: 1_048_576,
});

await app.register(cookie);
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
await app.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });

const applicationOrigin = new URL(config.appUrl).origin;
app.addHook('preHandler', async (request, reply) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  if (!request.cookies?.[config.cookieName]) return;
  if (request.url === '/api/webhooks/stripe') return;
  const origin = request.headers.origin;
  if (!origin || origin !== applicationOrigin) {
    return reply.code(403).send({ error: 'Cross-origin request rejected' });
  }
});

app.get('/api/health', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', database: 'connected' };
  } catch {
    return reply.code(503).send({ status: 'degraded', database: 'unavailable' });
  }
});

await registerAuthRoutes(app);
await registerEntityRoutes(app);
await registerFunctionRoutes(app);

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
let hasDist = false;
try {
  await access(join(dist, 'index.html'));
  hasDist = true;
} catch {}

if (hasDist) {
  await app.register(fastifyStatic, { root: dist, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/functions/')) return reply.code(404).send({ error: 'Not found' });
    return reply.sendFile('index.html');
  });
}

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const status = Number(error.statusCode || error.status || 500);
  reply.code(status >= 400 && status < 600 ? status : 500).send({
    error: status >= 500 && config.production ? 'Internal server error' : error.message,
  });
});

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: config.host, port: config.port });
