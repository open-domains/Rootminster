import { authenticateRequest, publicUser } from './auth.js';
import { pool, transaction } from './database.js';
import { serializeUser, store } from './store.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export function validateTermsInput(body = {}) {
  const version = String(body.version || '').trim();
  const title = String(body.title || '').trim();
  const summary = String(body.summary || '').trim();
  const content = String(body.content || '').trim();
  if (!VERSION.test(version)) return { error: 'Version must contain only letters, numbers, dots, underscores or hyphens (64 characters maximum)' };
  if (!title || title.length > 160) return { error: 'Title is required and must be 160 characters or fewer' };
  if (summary.length > 2000) return { error: 'Summary must be 2,000 characters or fewer' };
  if (content.length < 50 || content.length > 100_000) return { error: 'Terms content must be between 50 and 100,000 characters' };
  return { value: { version, title, summary, content } };
}

async function requireAdmin(request, reply) {
  const actor = await authenticateRequest(request);
  if (!actor) { reply.code(401).send({ error: 'Unauthorized' }); return null; }
  if (actor.role !== 'admin') { reply.code(403).send({ error: 'Forbidden' }); return null; }
  return actor;
}

function validId(request, reply) {
  const id = String(request.params.id || '');
  if (!UUID.test(id)) { reply.code(400).send({ error: 'Invalid Terms version ID' }); return null; }
  return id;
}

function publicTerms(row) {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    summary: row.summary,
    content: row.content,
    effective_at: row.effective_at,
    published_at: row.published_at,
    is_current: row.is_current,
  };
}

async function audit(actor, action, description, executor = pool) {
  await store.create('AuditLog', {
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    entity_type: 'TermsVersion',
    description,
  }, actor, executor);
}

export async function registerTermsRoutes(app) {
  app.get('/api/terms/current', async (_request, reply) => {
    const result = await pool.query("SELECT * FROM terms_versions WHERE status = 'published' AND is_current = true LIMIT 1");
    if (!result.rowCount) return reply.code(503).send({ error: 'No Terms of Service version is currently published' });
    return reply.header('Cache-Control', 'no-cache').send({ terms: publicTerms(result.rows[0]) });
  });

  app.get('/api/terms/versions', async (_request, reply) => {
    const result = await pool.query("SELECT id, version, title, summary, effective_at, published_at, is_current FROM terms_versions WHERE status = 'published' ORDER BY published_at DESC, created_at DESC");
    return reply.header('Cache-Control', 'no-cache').send({ versions: result.rows });
  });

  app.get('/api/terms/versions/:version', async (request, reply) => {
    const version = String(request.params.version || '');
    if (!VERSION.test(version)) return reply.code(400).send({ error: 'Invalid Terms version' });
    const result = await pool.query("SELECT * FROM terms_versions WHERE version = $1 AND status = 'published'", [version]);
    if (!result.rowCount) return reply.code(404).send({ error: 'Terms version not found' });
    return reply.header('Cache-Control', 'no-cache').send({ terms: publicTerms(result.rows[0]) });
  });

  app.post('/api/terms/accept', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await authenticateRequest(request);
    if (!actor) return reply.code(401).send({ error: 'Unauthorized' });
    const updated = await transaction(async (client) => {
      const current = await client.query("SELECT id, version FROM terms_versions WHERE status = 'published' AND is_current = true FOR SHARE");
      if (!current.rowCount) throw Object.assign(new Error('No Terms of Service version is currently published'), { status: 503 });
      const terms = current.rows[0];
      await client.query(
        `INSERT INTO terms_acceptances(user_id, terms_version_id, version, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, terms_version_id) DO NOTHING`,
        [actor.id, terms.id, terms.version, request.ip || null, String(request.headers['user-agent'] || '').slice(0, 500) || null],
      );
      return client.query(
        'UPDATE users SET tos_accepted_at = now(), tos_accepted_version = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [terms.version, actor.id],
      );
    });
    return { user: publicUser(serializeUser(updated.rows[0])) };
  });

  app.get('/api/admin/terms', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const result = await pool.query(
      `SELECT tv.*, count(ta.id)::integer AS acceptance_count
       FROM terms_versions tv LEFT JOIN terms_acceptances ta ON ta.terms_version_id = tv.id
       GROUP BY tv.id ORDER BY tv.is_current DESC, tv.created_at DESC`,
    );
    return reply.header('Cache-Control', 'no-store').send({ versions: result.rows });
  });

  app.post('/api/admin/terms', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    const parsed = validateTermsInput(request.body);
    if (parsed.error) return reply.code(400).send({ error: parsed.error });
    try {
      const result = await transaction(async (client) => {
        const created = await client.query(
          `INSERT INTO terms_versions(version, title, summary, content, created_by_id, created_by_email)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [parsed.value.version, parsed.value.title, parsed.value.summary, parsed.value.content, actor.id, actor.email],
        );
        await audit(actor, 'terms_draft_created', `Created Terms draft ${parsed.value.version}`, client);
        return created;
      });
      return reply.code(201).send({ terms: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return reply.code(409).send({ error: 'That Terms version already exists' });
      throw error;
    }
  });

  app.put('/api/admin/terms/:id', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    const id = actor && validId(request, reply);
    if (!id) return;
    const parsed = validateTermsInput(request.body);
    if (parsed.error) return reply.code(400).send({ error: parsed.error });
    try {
      const result = await transaction(async (client) => {
        const updated = await client.query(
          `UPDATE terms_versions SET version = $1, title = $2, summary = $3, content = $4, updated_at = now()
           WHERE id = $5 AND status = 'draft' RETURNING *`,
          [parsed.value.version, parsed.value.title, parsed.value.summary, parsed.value.content, id],
        );
        if (updated.rowCount) await audit(actor, 'terms_draft_updated', `Updated Terms draft ${parsed.value.version}`, client);
        return updated;
      });
      if (!result.rowCount) return reply.code(409).send({ error: 'Published Terms versions are immutable' });
      return { terms: result.rows[0] };
    } catch (error) {
      if (error.code === '23505') return reply.code(409).send({ error: 'That Terms version already exists' });
      throw error;
    }
  });

  app.post('/api/admin/terms/:id/publish', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    const id = actor && validId(request, reply);
    if (!id) return;
    const result = await transaction(async (client) => {
      const draft = await client.query("SELECT * FROM terms_versions WHERE id = $1 AND status = 'draft' FOR UPDATE", [id]);
      if (!draft.rowCount) return null;
      if (request.body?.confirmation !== draft.rows[0].version) {
        throw Object.assign(new Error('Enter the version exactly to confirm publication'), { status: 400 });
      }
      await client.query('UPDATE terms_versions SET is_current = false WHERE is_current = true');
      const published = await client.query(
        `UPDATE terms_versions SET status = 'published', is_current = true, effective_at = now(), published_at = now(),
          published_by_id = $1, published_by_email = $2, updated_at = now() WHERE id = $3 RETURNING *`,
        [actor.id, actor.email, id],
      );
      await audit(actor, 'terms_version_published', `Published Terms ${published.rows[0].version} as the current version`, client);
      return published;
    });
    if (!result) return reply.code(409).send({ error: 'Only draft Terms can be published' });
    return { terms: result.rows[0] };
  });

  app.delete('/api/admin/terms/:id', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    const id = actor && validId(request, reply);
    if (!id) return;
    const result = await transaction(async (client) => {
      const deleted = await client.query("DELETE FROM terms_versions WHERE id = $1 AND status = 'draft' RETURNING version", [id]);
      if (deleted.rowCount) await audit(actor, 'terms_draft_deleted', `Deleted Terms draft ${deleted.rows[0].version}`, client);
      return deleted;
    });
    if (!result.rowCount) return reply.code(409).send({ error: 'Only draft Terms can be deleted' });
    return { success: true };
  });
}
