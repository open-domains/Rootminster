import { createHash, timingSafeEqual } from 'node:crypto';
import { createSession, publicUser } from './auth.js';
import { config } from './config.js';
import { pool, transaction } from './database.js';
import { hashPassword } from './security.js';
import { serializeUser } from './store.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setupKeyMatches(candidate) {
  if (!config.initialSetupKey || typeof candidate !== 'string') return false;
  const expected = createHash('sha256').update(config.initialSetupKey).digest();
  const received = createHash('sha256').update(candidate).digest();
  return timingSafeEqual(expected, received);
}

export function validateSetupInput(body = {}) {
  const firstName = String(body.firstName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!firstName || firstName.length > 80) return { error: 'Enter a first name of 80 characters or fewer' };
  if (!emailPattern.test(email)) return { error: 'Enter a valid email address' };
  if (password.length < 12) return { error: 'Password must be at least 12 characters' };
  return { firstName, email, password };
}

async function setupStatus() {
  const result = await pool.query('SELECT EXISTS(SELECT 1 FROM users) AS installed');
  return {
    required: !result.rows[0].installed,
    setup_key_configured: Boolean(config.initialSetupKey),
    app_url: config.appUrl,
    integrations: {
      smtp: Boolean(config.smtp.host),
      cloudflare: Boolean(config.cloudflareToken),
      turnstile: Boolean(config.turnstileSiteKey && config.turnstileSecret),
      google_oauth: Boolean(config.googleClientId && config.googleClientSecret),
      github_oauth: Boolean(config.githubClientId && config.githubClientSecret),
      mcp: config.mcpEnabled,
      donations: config.donationsEnabled,
    },
  };
}

export async function registerSetupRoutes(app) {
  app.get('/api/setup/status', async () => setupStatus());

  app.post('/api/setup/initialize', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    if (!config.initialSetupKey) return reply.code(503).send({ error: 'Set INITIAL_SETUP_KEY on the server before running initial setup' });
    if (!setupKeyMatches(request.body?.setupKey)) return reply.code(403).send({ error: 'Invalid initial setup key' });
    const input = validateSetupInput(request.body);
    if (input.error) return reply.code(400).send({ error: input.error });
    const passwordHash = await hashPassword(input.password);
    let row;
    try {
      row = await transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('rootminster-initial-setup'))");
        const existing = await client.query('SELECT EXISTS(SELECT 1 FROM users) AS installed');
        if (existing.rows[0].installed) throw Object.assign(new Error('Rootminster has already been set up'), { status: 409 });
        const created = await client.query(
          `INSERT INTO users(email, password_hash, full_name, display_name, role, status, email_verified_at)
           VALUES ($1, $2, $3, $3, 'admin', 'active', now()) RETURNING *`,
          [input.email, passwordHash, input.firstName],
        );
        await client.query(
          `INSERT INTO entity_records(entity_type, data, created_by_id, created_by_email)
           VALUES ('AuditLog', $1::jsonb, $2, $3)`,
          [JSON.stringify({ actor_email: input.email, actor_role: 'admin', action: 'initial_setup_completed', entity_type: 'PlatformSettings', description: 'Initial Rootminster administrator created' }), created.rows[0].id, input.email],
        );
        return created.rows[0];
      });
    } catch (error) {
      return reply.code(error.status || 500).send({ error: error.status ? error.message : 'Initial setup failed' });
    }
    await createSession(row.id, request, reply);
    return reply.code(201).send({ success: true, user: publicUser(serializeUser(row)) });
  });
}
