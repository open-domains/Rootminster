import { config } from './config.js';
import { decryptSettingSecret, encryptSettingSecret } from './security.js';
import { store } from './store.js';

const MODULE_PREFIX = 'module_config:';
const cache = new Map();
const CACHE_MS = 15_000;

export const MODULE_DEFINITIONS = Object.freeze({
  module_store: {
    name: 'Module Store', description: 'Install integrity-verified modules from the official curated GitHub registry.', defaultEnabled: true,
    fields: [
      { key: 'registry_url', label: 'Registry URL', type: 'url', required: true },
    ],
    env: () => ({ enabled: true, registry_url: process.env.MODULE_REGISTRY_URL || 'https://raw.githubusercontent.com/open-domains/Rootminster-modules/main/registry.json' }),
  },
  cloudflare: {
    name: 'Cloudflare DNS', description: 'Cloudflare zones, DNS records and synchronisation.', defaultEnabled: true,
    fields: [
      { key: 'api_token', label: 'API token', type: 'secret', required: true },
    ],
    env: () => ({ enabled: Boolean(config.cloudflareToken), api_token: config.cloudflareToken }),
  },
  email: {
    name: 'Email', description: 'SMTP delivery for verification links, password resets and status updates.', defaultEnabled: true,
    fields: [
      { key: 'host', label: 'SMTP host', type: 'text', required: true },
      { key: 'port', label: 'SMTP port', type: 'number', required: true },
      { key: 'secure', label: 'Use implicit TLS', type: 'boolean' },
      { key: 'user', label: 'SMTP username', type: 'text' },
      { key: 'password', label: 'SMTP password', type: 'secret' },
      { key: 'from', label: 'From address', type: 'text', required: true },
      { key: 'contact_email', label: 'Contact recipient', type: 'text', required: true },
      { key: 'require_verification', label: 'Require email verification for registration', type: 'boolean' },
    ],
    env: () => ({ enabled: Boolean(config.smtp.host), ...config.smtp, contact_email: config.contactEmail, require_verification: config.emailVerificationRequired }),
  },
  turnstile: {
    name: 'Cloudflare Turnstile', description: 'Bot protection for public registration and request forms.', defaultEnabled: false,
    fields: [
      { key: 'site_key', label: 'Site key', type: 'text', required: true },
      { key: 'secret_key', label: 'Secret key', type: 'secret', required: true },
    ],
    env: () => ({ enabled: Boolean(config.turnstileSiteKey && config.turnstileSecret), site_key: config.turnstileSiteKey, secret_key: config.turnstileSecret }),
  },
  donations: {
    name: 'Donations and Stripe', description: 'Stripe donations and donation-gated NS records.', defaultEnabled: false,
    fields: [
      { key: 'secret_key', label: 'Stripe secret key', type: 'secret', required: true },
      { key: 'webhook_secret', label: 'Stripe webhook secret', type: 'secret', required: true },
    ],
    env: () => ({ enabled: config.donationsEnabled, secret_key: config.stripeSecret, webhook_secret: config.stripeWebhookSecret }),
  },
  google_oauth: {
    name: 'Google OAuth', description: 'Allow users to register and sign in with Google.', defaultEnabled: false,
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client secret', type: 'secret', required: true },
    ],
    env: () => ({ enabled: Boolean(config.googleClientId && config.googleClientSecret), client_id: config.googleClientId, client_secret: config.googleClientSecret }),
  },
  github_oauth: {
    name: 'GitHub OAuth', description: 'Allow users to register and sign in with GitHub.', defaultEnabled: false,
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client secret', type: 'secret', required: true },
      { key: 'registry_url', label: 'Migration registry URL', type: 'url' },
    ],
    env: () => ({ enabled: Boolean(config.githubClientId && config.githubClientSecret), client_id: config.githubClientId, client_secret: config.githubClientSecret, registry_url: config.githubRegistryUrl }),
  },
  discord: {
    name: 'Discord bot', description: 'Signed slash commands for users and staff request management.', defaultEnabled: false,
    fields: [
      { key: 'application_id', label: 'Application ID', type: 'text', required: true },
      { key: 'public_key', label: 'Public key', type: 'secret', required: true },
      { key: 'bot_token', label: 'Bot token', type: 'secret', required: true },
      { key: 'guild_id', label: 'Development guild ID', type: 'text' },
    ],
    env: () => ({ enabled: config.discordBot.enabled, application_id: config.discordBot.applicationId, public_key: config.discordBot.publicKey, bot_token: config.discordBot.token, guild_id: config.discordBot.guildId }),
  },
  safety: {
    name: 'Automated safety screening', description: 'Deterministic screening with an optional reputation provider.', defaultEnabled: true,
    fields: [
      { key: 'provider_url', label: 'Reputation provider URL', type: 'url' },
      { key: 'provider_token', label: 'Provider bearer token', type: 'secret' },
      { key: 'provider_timeout_ms', label: 'Provider timeout (ms)', type: 'number' },
    ],
    env: () => ({ enabled: config.safety.enabled, provider_url: config.safety.providerUrl, provider_token: config.safety.providerToken, provider_timeout_ms: config.safety.providerTimeoutMs }),
  },
  mcp: {
    name: 'MCP server', description: 'Role-aware ChatGPT and Claude account tools.', defaultEnabled: true,
    fields: [], env: () => ({ enabled: config.mcpEnabled }),
  },
  analytics: {
    name: 'Umami analytics', description: 'Per-subdomain analytics dashboards.', defaultEnabled: false,
    fields: [
      { key: 'base_url', label: 'Umami base URL', type: 'url', required: true },
      { key: 'api_endpoint', label: 'API endpoint', type: 'url' },
      { key: 'user_id', label: 'API user ID', type: 'text' },
      { key: 'api_secret', label: 'API client secret', type: 'secret' },
      { key: 'website_id', label: 'Website ID', type: 'text' },
    ],
    env: () => ({ enabled: Boolean(process.env.UMAMI_URL || process.env.UMAMI_API_URL), base_url: process.env.UMAMI_URL || process.env.UMAMI_BASE_URL || config.umami.apiUrl, api_endpoint: process.env.UMAMI_API_CLIENT_ENDPOINT || '', user_id: process.env.UMAMI_API_CLIENT_USER_ID || process.env.UMAMI_USER_ID || config.umami.username, api_secret: process.env.UMAMI_API_CLIENT_SECRET || process.env.UMAMI_APP_SECRET || config.umami.password, website_id: process.env.UMAMI_WEBSITE_ID || config.umami.websiteId }),
  },
});

function secretKeys(definition) {
  return new Set(definition.fields.filter((field) => field.type === 'secret').map((field) => field.key));
}

function normaliseField(field, value) {
  if (field.type === 'boolean') return value === true || value === 'true';
  if (field.type === 'number') return Math.max(0, Math.min(Number(value) || 0, 10_000_000));
  return String(value ?? '').trim().slice(0, field.type === 'secret' ? 10_000 : 2_000);
}

async function storedModule(id) {
  const rows = await store.filter('PlatformSettings', { key: `${MODULE_PREFIX}${id}` }, '-created_date', 1);
  if (!rows[0]?.value) return null;
  try { return { record: rows[0], value: JSON.parse(rows[0].value) }; } catch { return null; }
}

export async function getModuleConfig(id, { fresh = false } = {}) {
  const definition = MODULE_DEFINITIONS[id];
  if (!definition) throw Object.assign(new Error('Unknown module'), { status: 404 });
  const cached = cache.get(id);
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const stored = await storedModule(id);
  const source = stored ? stored.value : definition.env();
  const secrets = secretKeys(definition);
  const value = { enabled: source.enabled ?? definition.defaultEnabled };
  for (const field of definition.fields) {
    const raw = source[field.key];
    value[field.key] = secrets.has(field.key) && String(raw || '').startsWith('enc:v1:') ? decryptSettingSecret(raw) : normaliseField(field, raw);
  }
  cache.set(id, { at: Date.now(), value });
  return value;
}

export async function saveModule(id, input, actor, { importEnvironment = false } = {}) {
  const definition = MODULE_DEFINITIONS[id];
  if (!definition) throw Object.assign(new Error('Unknown module'), { status: 404 });
  const existing = await storedModule(id);
  const current = existing?.value || {};
  const environment = definition.env();
  const secrets = secretKeys(definition);
  const output = { enabled: input.enabled ?? current.enabled ?? environment.enabled ?? definition.defaultEnabled };
  for (const field of definition.fields) {
    let supplied = importEnvironment ? environment[field.key] : input.settings?.[field.key];
    if (secrets.has(field.key)) {
      if (input.clear_secrets?.includes(field.key)) supplied = '';
      if (supplied === undefined || supplied === '') {
        output[field.key] = current[field.key] || (environment[field.key] ? encryptSettingSecret(environment[field.key]) : '');
      } else output[field.key] = encryptSettingSecret(normaliseField(field, supplied));
    } else {
      output[field.key] = normaliseField(field, supplied === undefined ? (current[field.key] ?? environment[field.key]) : supplied);
    }
  }
  if (output.enabled) {
    const missing = definition.fields.filter((field) => field.required && !output[field.key]).map((field) => field.label);
    if (missing.length) throw Object.assign(new Error(`Configure ${missing.join(', ')} before enabling ${definition.name}`), { status: 400 });
  }
  const data = { key: `${MODULE_PREFIX}${id}`, value: JSON.stringify(output), description: `${definition.name} module configuration` };
  if (existing?.record) await store.update('PlatformSettings', existing.record.id, data);
  else await store.create('PlatformSettings', data, actor);
  cache.delete(id);
  return getModuleConfig(id, { fresh: true });
}

function adminView(id, definition, runtime, stored) {
  const secrets = secretKeys(definition);
  return {
    id, name: definition.name, description: definition.description, enabled: Boolean(runtime.enabled),
    source: stored ? 'database' : 'environment',
    fields: definition.fields.map((field) => ({
      ...field,
      value: secrets.has(field.key) ? '' : runtime[field.key],
      configured: secrets.has(field.key) ? Boolean(runtime[field.key]) : undefined,
    })),
  };
}

export async function registerModuleSettingsRoutes(app) {
  app.get('/api/admin/modules', async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || actor.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    const modules = await Promise.all(Object.entries(MODULE_DEFINITIONS).map(async ([id, definition]) => {
      const [runtime, stored] = await Promise.all([getModuleConfig(id, { fresh: true }), storedModule(id)]);
      return adminView(id, definition, runtime, stored);
    }));
    return { modules, encryption_configured: Boolean(process.env.MODULE_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY) };
  });

  app.put('/api/admin/modules/:id', async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || actor.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    try {
      const runtime = await saveModule(request.params.id, request.body || {}, actor);
      await store.create('AuditLog', { actor_email: actor.email, actor_role: actor.role, action: 'module_configuration_updated', entity_type: 'PlatformSettings', description: `${MODULE_DEFINITIONS[request.params.id].name} module updated; enabled=${runtime.enabled}` }, actor);
      return { module: adminView(request.params.id, MODULE_DEFINITIONS[request.params.id], runtime, true) };
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/admin/modules/import-environment', async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || actor.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    if (!process.env.MODULE_ENCRYPTION_KEY && !process.env.TOTP_ENCRYPTION_KEY) return reply.code(503).send({ error: 'Configure MODULE_ENCRYPTION_KEY before importing secrets' });
    await Promise.all(Object.keys(MODULE_DEFINITIONS).map((id) => saveModule(id, {}, actor, { importEnvironment: true })));
    await store.create('AuditLog', { actor_email: actor.email, actor_role: actor.role, action: 'module_environment_imported', entity_type: 'PlatformSettings', description: 'Imported optional module configuration from environment variables into encrypted database settings' }, actor);
    return { success: true };
  });
}
