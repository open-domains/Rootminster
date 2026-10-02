import { access, readFile } from 'node:fs/promises';
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
import { shouldServeSpaFallback } from './static-fallback.js';
import { publicSitemapEntries, resolveSeo } from '../shared/seo.js';
import { registerSetupRoutes } from './setup.js';
import { registerDiscordRoutes } from './discord.js';
import { registerPublicApiRoutes } from './public-api.js';
import { getModuleConfig, registerModuleSettingsRoutes } from './module-settings.js';
import { registerDesignRoutes } from './design.js';
import { contentSecurityPolicy } from './csp.js';
import { captureServerException, closeServerGlitchTip, configureServerGlitchTip, registerGlitchTipRoutes } from './glitchtip.js';
import { backupRestoreInProgress } from './backup-service.js';
import { registerBackupRoutes } from './backup-routes.js';
import { registerTermsRoutes } from './terms-routes.js';
import { registerAccountDeletionRoutes } from './account-deletion-routes.js';
import { registerPasskeyRoutes } from './passkeys.js';
import { registerImpersonationRoutes } from './impersonation-routes.js';
import { registerDockerManagerRoutes } from './docker-manager.js';
import { registerObserverRoutes } from './observer.js';

assertProductionConfiguration();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          host: request.host,
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort,
        };
      },
    },
  },
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

app.addHook('onRequest', async (request, reply) => {
  if (backupRestoreInProgress() && request.url.split('?')[0] !== '/api/health') {
    return reply.header('Retry-After', '60').code(503).send({ error: 'Rootminster is restoring a database backup' });
  }
});

const applicationOrigin = new URL(config.appUrl).origin;
app.addHook('preHandler', async (request, reply) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  if (!request.cookies?.[config.cookieName]) return;
  if (request.url === '/api/webhooks/stripe') return;
  if (request.method === 'POST' && request.url.split('?')[0] === '/api/auth/logout') return;
  if (request.method === 'POST' && ['/oauth/authorize', '/api/design-auth/authorize'].includes(request.url.split('?')[0])) return;
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

await registerImpersonationRoutes(app);
await registerAuthRoutes(app);
await registerPasskeyRoutes(app);
await registerSetupRoutes(app);
await registerDiscordRoutes(app);
await registerPublicApiRoutes(app);
await registerModuleSettingsRoutes(app);
await registerDockerManagerRoutes(app);
await registerObserverRoutes(app);
await registerDesignRoutes(app);
await registerBackupRoutes(app);
await registerTermsRoutes(app);
await registerAccountDeletionRoutes(app);
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
  const indexTemplate = await readFile(join(dist, 'index.html'), 'utf8');
  const escapeHtml = (value) => String(value).replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const renderIndex = (request) => {
    const seo = resolveSeo(new URL(request.url, config.appUrl).pathname, config.appUrl);
    const tags = [
      `<title>${escapeHtml(seo.title)}</title>`,
      `<meta name="description" content="${escapeHtml(seo.description)}">`,
      `<meta name="robots" content="${escapeHtml(seo.robots)}">`,
      `<link rel="canonical" href="${escapeHtml(seo.canonical)}">`,
      '<link rel="icon" type="image/png" href="/open-domains-icon.png">',
      '<link rel="apple-touch-icon" href="/open-domains-icon.png">',
      `<meta property="og:site_name" content="${escapeHtml(seo.siteName)}">`,
      `<meta property="og:type" content="${escapeHtml(seo.type)}">`,
      `<meta property="og:title" content="${escapeHtml(seo.title)}">`,
      `<meta property="og:description" content="${escapeHtml(seo.description)}">`,
      `<meta property="og:url" content="${escapeHtml(seo.canonical)}">`,
      `<meta property="og:image" content="${escapeHtml(seo.image)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escapeHtml(seo.title)}">`,
      `<meta name="twitter:description" content="${escapeHtml(seo.description)}">`,
      `<meta name="twitter:image" content="${escapeHtml(seo.image)}">`,
    ].join('\n    ');
    return indexTemplate.replace('<!--rootminster-meta-->', tags);
  };

  app.get('/robots.txt', async (_request, reply) => reply
    .type('text/plain; charset=utf-8')
    .send(`User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', config.appUrl).href}\n`));

  app.get('/sitemap.xml', async (_request, reply) => {
    const now = new Date().toISOString().slice(0, 10);
    const urls = publicSitemapEntries(config.appUrl).map(({ loc }) => `  <url><loc>${escapeHtml(loc)}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`).join('\n');
    return reply.type('application/xml; charset=utf-8').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  await app.register(fastifyStatic, {
    root: dist,
    wildcard: false,
    etag: true,
    index: false,
  });

  app.get('/', async (request, reply) => reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(renderIndex(request)));

  app.setNotFoundHandler((request, reply) => {
    if (!shouldServeSpaFallback(request.url)) {
      return reply.header('Cache-Control', 'no-store').code(404).send({ error: 'Not found' });
    }
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(renderIndex(request));
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
