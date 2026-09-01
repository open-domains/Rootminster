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
import { registerMcpRoutes } from './mcp.js';
import { registerSetupRoutes } from './setup.js';
import { registerDiscordRoutes } from './discord.js';
import { registerPublicApiRoutes } from './public-api.js';
import { getModuleConfig, registerModuleSettingsRoutes } from './module-settings.js';
import { registerModuleStoreRoutes } from './module-store.js';

assertProductionConfiguration();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  trustProxy: config.trustProxy,
  bodyLimit: 1_048_576,
});

await app.register(cookie);
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://media.rootminster.com', 'https://flagcdn.com'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
});
await app.register(rateLimit, {
  max: 300,
  timeWindow: '1 minute',
  errorResponseBuilder: (_request, context) => ({
    error: {
      code: 'rate_limit_exceeded',
      message: `Too many requests. Try again in ${context.after}.`,
    },
  }),
});
await app.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });
app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
  try {
    done(null, Object.fromEntries(new URLSearchParams(body)));
  } catch (error) {
    done(error);
  }
});

const applicationOrigin = new URL(config.appUrl).origin;
app.addHook('preHandler', async (request, reply) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  if (!request.cookies?.[config.cookieName]) return;
  if (request.url === '/api/webhooks/stripe') return;
  if (request.method === 'POST' && request.url.split('?')[0] === '/api/auth/logout') return;
  if (request.method === 'POST' && request.url.split('?')[0] === '/oauth/authorize') return;
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

app.get('/api/config', async () => {
  const [donations, google, github, discord] = await Promise.all([
    getModuleConfig('donations'), getModuleConfig('google_oauth'), getModuleConfig('github_oauth'), getModuleConfig('discord'),
  ]);
  return {
    features: { donations: donations.enabled, nsRequiresDonation: donations.enabled },
    oauth: { google: Boolean(google.enabled && google.client_id && google.client_secret), github: Boolean(github.enabled && github.client_id && github.client_secret) },
    discordBot: Boolean(discord.enabled && discord.application_id && discord.public_key && discord.bot_token),
  };
});

await registerAuthRoutes(app);
await registerSetupRoutes(app);
await registerDiscordRoutes(app);
await registerPublicApiRoutes(app);
await registerModuleSettingsRoutes(app);
await registerModuleStoreRoutes(app);
await registerEntityRoutes(app);
await registerFunctionRoutes(app);
await registerMcpRoutes(app);

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
