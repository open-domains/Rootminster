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
import { contentSecurityPolicy } from './csp.js';
import { captureServerException, closeServerGlitchTip, configureServerGlitchTip, registerGlitchTipRoutes } from './glitchtip.js';

assertProductionConfiguration();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  trustProxy: config.trustProxy,
  bodyLimit: 1_048_576,
});

try {
  await configureServerGlitchTip(await getModuleConfig('glitchtip'));
} catch (error) {
  app.log.error({ err: error }, 'GlitchTip monitoring could not start');
}

await app.register(cookie);
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: contentSecurityPolicy,
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
  const [donations, google, github, discord, branding, glitchtip] = await Promise.all([
    getModuleConfig('donations'), getModuleConfig('google_oauth'), getModuleConfig('github_oauth'), getModuleConfig('discord'),
    getModuleConfig('branding'), getModuleConfig('glitchtip'),
  ]);
  const defaultBranding = { platform_name: 'Open Domains', short_name: 'OpenDomains', logo_url: '/open-domains-icon.png', primary_color: '#2563eb', support_url: '/contact' };
  const publicBranding = branding.enabled ? {
    platform_name: String(branding.platform_name || defaultBranding.platform_name).slice(0, 80),
    short_name: String(branding.short_name || defaultBranding.short_name).slice(0, 40),
    logo_url: /^(https:\/\/|\/)/.test(branding.logo_url) ? branding.logo_url : defaultBranding.logo_url,
    primary_color: /^#[0-9a-f]{6}$/i.test(branding.primary_color) ? branding.primary_color : defaultBranding.primary_color,
    support_url: /^(https:\/\/|\/)/.test(branding.support_url) ? branding.support_url : defaultBranding.support_url,
  } : defaultBranding;
  return {
    features: { donations: donations.enabled, nsRequiresDonation: donations.enabled },
    oauth: { google: Boolean(google.enabled && google.client_id && google.client_secret), github: Boolean(github.enabled && github.client_id && github.client_secret) },
    discordBot: Boolean(discord.enabled && discord.application_id && discord.public_key && discord.bot_token),
    glitchtip: glitchtip.enabled && glitchtip.dsn ? {
      enabled: true,
      dsn: glitchtip.dsn,
      environment: glitchtip.environment || (config.production ? 'production' : 'development'),
      errorSampleRate: Math.max(0, Math.min(Number(glitchtip.error_sample_rate) || 0, 1)),
      traceSampleRate: Math.max(0, Math.min(Number(glitchtip.trace_sample_rate) || 0, 1)),
      tunnel: '/api/observability/envelope',
    } : { enabled: false },
    branding: publicBranding,
  };
});

await registerAuthRoutes(app);
await registerSetupRoutes(app);
await registerDiscordRoutes(app);
await registerPublicApiRoutes(app);
await registerModuleSettingsRoutes(app);
await registerGlitchTipRoutes(app);
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
  await app.register(fastifyStatic, {
    root: dist,
    wildcard: false,
    etag: true
  });
  app.setNotFoundHandler((request, reply) => {
    if (/^\/(?:api|functions)(?:[/?]|$)/.test(request.url)) {
      return reply.header('Cache-Control', 'no-store').code(404).send({ error: 'Not found' });
    }
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
  });
}

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const status = Number(error.statusCode || error.status || 500);
  const responseStatus = status >= 400 && status < 600 ? status : 500;
  if (responseStatus >= 500) {
    captureServerException(error, {
      method: request.method,
      route: request.routeOptions?.url || request.url.split('?')[0],
      requestId: request.id,
    });
  }
  reply.header('Cache-Control', 'no-store').code(responseStatus).send({
    error: status >= 500 && config.production ? 'Internal server error' : error.message,
  });
});

const shutdown = async () => {
  await app.close();
  await closeServerGlitchTip();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: config.host, port: config.port });
