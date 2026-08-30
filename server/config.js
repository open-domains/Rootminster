const production = process.env.NODE_ENV === 'production';

function integer(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) ? value : fallback;
}

export const config = Object.freeze({
  production,
  port: integer('PORT', 3001),
  host: process.env.HOST || '0.0.0.0',
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://rootminster:rootminster@localhost:5432/rootminster',
  databasePoolSize: integer('DATABASE_POOL_SIZE', 20),
  sessionDays: integer('SESSION_DAYS', 30),
  cookieName: process.env.SESSION_COOKIE_NAME || 'rootminster_session',
  emailVerificationRequired: process.env.EMAIL_VERIFICATION_REQUIRED !== 'false',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: integer('SMTP_PORT', 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'Open Domains <no-reply@open-domains.com>',
  },
  contactEmail: process.env.CONTACT_EMAIL || 'hello@open-domains.net',
  cloudflareToken: process.env.CLOUDFLARE_API_TOKEN || '',
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY || '',
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || process.env.RECAPTCHA_SITE_KEY || '',
  stripeSecret: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  umami: {
    apiUrl: process.env.UMAMI_API_URL || '',
    username: process.env.UMAMI_USERNAME || '',
    password: process.env.UMAMI_PASSWORD || '',
    websiteId: process.env.UMAMI_WEBSITE_ID || '',
  },
  dockerSocket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  githubRegistryUrl: process.env.GITHUB_REGISTRY_URL || 'https://raw.githubusercontent.com/open-domains/register/main/domains.json',
});

export function assertProductionConfiguration() {
  if (!config.production) return;
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.APP_URL) missing.push('APP_URL');
  if (missing.length) throw new Error(`Missing required production settings: ${missing.join(', ')}`);
}
