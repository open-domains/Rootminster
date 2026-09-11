import { authenticateRequest } from './auth.js';
import { pool } from './database.js';
import { sendEmail } from './mail.js';
import { deleteUserAccounts } from './lib/admin-user-deletion.js';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

async function requireUser(request, reply) {
  const user = await authenticateRequest(request);
  if (!user) {
    reply.code(401).send({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

async function requireAdmin(request, reply) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (user.role !== 'admin') {
    reply.code(403).send({ error: 'Forbidden' });
    return null;
  }
  return user;
}

async function ensureDeletionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_deletion_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      user_email citext NOT NULL,
      user_name text,
      user_role text,
      reason text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'failed')),
      requested_at timestamptz NOT NULL DEFAULT now(),
      decided_at timestamptz,
      decided_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      decided_by_email citext,
      decision_reason text NOT NULL DEFAULT '',
      snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      deletion_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      notification_status text NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'failed', 'not_required')),
      notification_error text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS account_deletion_requests_status_idx ON account_deletion_requests(status, requested_at DESC)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_pending_user_unique ON account_deletion_requests(user_id) WHERE status = 'pending' AND user_id IS NOT NULL`);
}

async function userCaseSnapshot(user) {
  const email = String(user.email || '').toLowerCase();
  const userId = user.id;
  const result = await pool.query(
    `SELECT entity_type, id, data, created_at, updated_at
     FROM entity_records
     WHERE
       (entity_type IN ('DnsRecord', 'SubdomainOwnership')
         AND ((data->>'owner_id') = $1 OR lower(data->>'owner_email') = $2))
       OR (entity_type IN ('SubdomainRequest', 'EditRequest')
         AND ((data->>'requester_id') = $1 OR lower(data->>'requester_email') = $2))
       OR (entity_type IN ('Donation', 'ApiToken', 'TrustedDevice', 'DeviceCode')
         AND ((data->>'user_id') = $1 OR lower(data->>'user_email') = $2 OR lower(data->>'email') = $2))
       OR (entity_type = 'AbuseReport' AND lower(data->>'reporter_email') = $2)
     ORDER BY created_at DESC`,
    [userId, email],
  );

  const groups = {};
  for (const row of result.rows) {
    const record = {
      id: row.id,
      ...(row.data || {}),
      created_date: row.created_at?.toISOString?.() || row.created_at,
      updated_date: row.updated_at?.toISOString?.() || row.updated_at,
    };
    if (!groups[row.entity_type]) groups[row.entity_type] = [];
    groups[row.entity_type].push(record);
  }

  return {
    generated_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      full_name: user.full_name,
      role: user.role,
      status: user.status,
      email_verified_at: user.email_verified_at,
      tos_accepted_at: user.tos_accepted_at,
      tos_accepted_version: user.tos_accepted_version,
      ns_unlocked: user.ns_unlocked,
      legacy_donor: user.legacy_donor,
      totp_enabled: user.totp_enabled,
      created_date: user.created_date,
      updated_date: user.updated_date,
    },
    subdomains: groups.SubdomainOwnership || [],
    dns_records: groups.DnsRecord || [],
    requests: groups.SubdomainRequest || [],
    edit_requests: groups.EditRequest || [],
    donations: groups.Donation || [],
    abuse_reports: groups.AbuseReport || [],
    api_tokens: (groups.ApiToken || []).map(({ token_hash: _hash, ...item }) => item),
    trusted_devices: (groups.TrustedDevice || []).map(({ token_hash: _hash, ...item }) => item),
  };
}

async function currentUserRow(userId) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    display_name: row.display_name,
    role: row.role,
    status: row.status,
    email_verified_at: row.email_verified_at,
    tos_accepted_at: row.tos_accepted_at,
    tos_accepted_version: row.tos_accepted_version,
    ns_unlocked: row.ns_unlocked,
    legacy_donor: row.legacy_donor,
    totp_enabled: row.totp_enabled,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

async function notifyOutcome(requestRow, outcome, reason = '') {
  const approved = outcome === 'approved';
  const subject = approved ? 'Your Open Domains account deletion request was approved' : 'Your Open Domains account deletion request was not approved';
  const body = approved
    ? `<p>Hi ${escapeHtml(requestRow.user_name || 'there')},</p><p>Your account deletion request has been approved and your Open Domains account and associated managed data have been permanently deleted.</p><p>If you did not expect this message, please contact support.</p>`
    : `<p>Hi ${escapeHtml(requestRow.user_name || 'there')},</p><p>Your account deletion request was reviewed and was not approved.</p>${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}<p>Your account remains active. You can contact support if you have questions.</p>`;
  try {
    const delivery = await sendEmail({ to: requestRow.user_email, subject, body });
    if (delivery?.disabled) throw new Error('Email delivery is disabled');
    await pool.query(
      `UPDATE account_deletion_requests SET notification_status = 'sent', notification_error = NULL, updated_at = now() WHERE id = $1`,
      [requestRow.id],
    );
  } catch (error) {
    await pool.query(
      `UPDATE account_deletion_requests SET notification_status = 'failed', notification_error = $2, updated_at = now() WHERE id = $1`,
      [requestRow.id, String(error.message || error).slice(0, 1000)],
    );
  }
}

export async function registerAccountDeletionRoutes(app) {
  await ensureDeletionTable();

  app.get('/api/account-deletion-request', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const result = await pool.query(
      `SELECT id, reason, status, requested_at, decided_at, decision_reason, notification_status
       FROM account_deletion_requests
       WHERE user_id = $1 OR lower(user_email) = lower($2)
       ORDER BY requested_at DESC LIMIT 1`,
      [user.id, user.email],
    );
    return { request: result.rows[0] || null };
  });

  app.post('/api/account-deletion-request', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const reason = String(request.body?.reason || '').trim().slice(0, 2000);
    const existing = await pool.query(
      `SELECT id FROM account_deletion_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
      [user.id],
    );
    if (existing.rowCount) return reply.code(409).send({ error: 'You already have a pending account deletion request' });

    const snapshot = await userCaseSnapshot(user);
    const result = await pool.query(
      `INSERT INTO account_deletion_requests(user_id, user_email, user_name, user_role, reason, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, reason, status, requested_at`,
      [user.id, user.email, user.display_name || user.full_name || '', user.role, reason, JSON.stringify(snapshot)],
    );
    return reply.code(201).send({ request: result.rows[0] });
  });

  app.delete('/api/account-deletion-request/:id', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const result = await pool.query(
      `DELETE FROM account_deletion_requests
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING id`,
      [request.params.id, user.id],
    );
    if (!result.rowCount) return reply.code(404).send({ error: 'Pending deletion request not found' });
    return { success: true };
  });

  app.get('/api/admin/account-deletion-requests', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    const result = await pool.query(
      `SELECT * FROM account_deletion_requests ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END,
         requested_at DESC LIMIT 500`,
    );
    return { requests: result.rows };
  });

  app.get('/api/admin/account-deletion-requests/:id', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    const result = await pool.query('SELECT * FROM account_deletion_requests WHERE id = $1', [request.params.id]);
    if (!result.rowCount) return reply.code(404).send({ error: 'Deletion request not found' });
    const deletionRequest = result.rows[0];

    let snapshot = deletionRequest.snapshot || {};
    if (deletionRequest.user_id && deletionRequest.status === 'pending') {
      const liveUser = await currentUserRow(deletionRequest.user_id);
      if (liveUser) snapshot = await userCaseSnapshot(liveUser);
    }
    return { request: { ...deletionRequest, snapshot } };
  });

  app.post('/api/admin/account-deletion-requests/:id/decision', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    const decision = String(request.body?.decision || '');
    const reason = String(request.body?.reason || '').trim().slice(0, 2000);
    if (!['approve', 'deny'].includes(decision)) return reply.code(400).send({ error: 'Decision must be approve or deny' });
    if (decision === 'deny' && !reason) return reply.code(400).send({ error: 'A reason is required when denying a deletion request' });

    const locked = await pool.query(
      `UPDATE account_deletion_requests
       SET status = CASE WHEN $2 = 'approve' THEN 'approved' ELSE 'denied' END,
           decided_at = now(), decided_by_id = $3, decided_by_email = $4,
           decision_reason = $5, updated_at = now()
       WHERE id = $1 AND (status = 'pending' OR (status = 'failed' AND $2 = 'approve'))
       RETURNING *`,
      [request.params.id, decision, actor.id, actor.email, reason],
    );
    if (!locked.rowCount) return reply.code(409).send({ error: 'This deletion request has already been decided or no longer exists' });
    const deletionRequest = locked.rows[0];

    if (decision === 'deny') {
      await notifyOutcome(deletionRequest, 'denied', reason);
      return { success: true, status: 'denied' };
    }

    if (!deletionRequest.user_id) {
      await pool.query(
        `UPDATE account_deletion_requests SET status = 'failed', decision_reason = $2, updated_at = now() WHERE id = $1`,
        [deletionRequest.id, 'The user account no longer exists'],
      );
      return reply.code(409).send({ error: 'The user account no longer exists' });
    }

    try {
      const latestUser = await currentUserRow(deletionRequest.user_id);
      if (!latestUser) throw Object.assign(new Error('The user account no longer exists'), { status: 404 });
      const snapshot = await userCaseSnapshot(latestUser);
      await pool.query('UPDATE account_deletion_requests SET snapshot = $2::jsonb WHERE id = $1', [deletionRequest.id, JSON.stringify(snapshot)]);

      const summary = await deleteUserAccounts([deletionRequest.user_id], actor);
      await pool.query(
        `UPDATE account_deletion_requests
         SET deletion_summary = $2::jsonb, updated_at = now()
         WHERE id = $1`,
        [deletionRequest.id, JSON.stringify(summary)],
      );
      await notifyOutcome(deletionRequest, 'approved');
      return { success: true, status: 'approved', deletion_summary: summary };
    } catch (error) {
      await pool.query(
        `UPDATE account_deletion_requests
         SET status = 'failed', decision_reason = $2, updated_at = now()
         WHERE id = $1`,
        [deletionRequest.id, String(error.message || 'Account deletion failed').slice(0, 2000)],
      );
      return reply.code(error.status || 500).send({ error: error.message || 'Account deletion failed' });
    }
  });
}
