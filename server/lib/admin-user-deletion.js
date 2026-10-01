import { cloudflareFetch } from './cloudflare.js';
import { pool, transaction } from '../database.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normaliseUserDeletionIds(value) {
  if (!Array.isArray(value)) throw Object.assign(new Error('user_ids must be an array'), { status: 400 });
  const ids = [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length || ids.length > 100 || ids.some((id) => !UUID.test(id))) {
    throw Object.assign(new Error('Select between 1 and 100 valid user accounts'), { status: 400 });
  }
  return ids;
}

export function userDeletionTombstones(users, actor = {}) {
  return users.map((user) => ({
    user_id: user.id,
    user_email: String(user.email || '').toLowerCase(),
    user_role: user.role || null,
    deleted_by_id: actor.id || null,
    deleted_by_email: actor.email || null,
  }));
}

export async function ensureDeletedUserTombstoneTable(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS deleted_user_tombstones (
      user_id uuid PRIMARY KEY,
      user_email citext NOT NULL,
      user_role text,
      deleted_at timestamptz NOT NULL DEFAULT now(),
      deleted_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      deleted_by_email citext,
      source text NOT NULL DEFAULT 'account_deletion'
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS deleted_user_tombstones_email_idx ON deleted_user_tombstones(lower(user_email))`);
}

export async function upsertDeletedUserTombstones(db, rows) {
  if (!rows.length) return { inserted: 0 };
  await ensureDeletedUserTombstoneTable(db);
  const result = await db.query(
    `INSERT INTO deleted_user_tombstones(user_id, user_email, user_role, deleted_by_id, deleted_by_email)
     SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(user_id uuid, user_email citext, user_role text, deleted_by_id uuid, deleted_by_email citext)
     ON CONFLICT (user_id) DO UPDATE SET
       user_email = excluded.user_email,
       user_role = excluded.user_role,
       deleted_by_id = COALESCE(deleted_user_tombstones.deleted_by_id, excluded.deleted_by_id),
       deleted_by_email = COALESCE(deleted_user_tombstones.deleted_by_email, excluded.deleted_by_email)`,
    [JSON.stringify(rows)],
  );
  return { inserted: result.rowCount || 0 };
}

async function deleteCloudflareRecords(records) {
  const failures = [];
  const queue = [...records];
  const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
    while (queue.length) {
      const record = queue.shift();
      try {
        const result = await cloudflareFetch('DELETE', `/zones/${record.zone_id}/dns_records/${record.cloudflare_record_id}`);
        if (!result.success && result._httpStatus !== 404) failures.push({ record, message: result.errors?.[0]?.message || 'unknown error' });
      } catch (error) {
        failures.push({ record, message: error.message });
      }
    }
  });
  await Promise.all(workers);
  if (failures.length) {
    const first = failures[0];
    throw Object.assign(
      new Error(`Cloudflare could not delete ${failures.length} DNS record(s). First failure: ${first.record.name || first.record.cloudflare_record_id} — ${first.message}`),
      { status: 502 },
    );
  }
}

export async function deleteUserAccounts(rawIds, actor) {
  const userIds = normaliseUserDeletionIds(rawIds);
  if (userIds.includes(actor.id)) throw Object.assign(new Error('You cannot delete your own account'), { status: 400 });

  const targetResult = await pool.query(
    'SELECT id, email, role FROM users WHERE id = ANY($1::uuid[])',
    [userIds],
  );
  if (targetResult.rowCount !== userIds.length) throw Object.assign(new Error('One or more selected users no longer exist'), { status: 404 });

  const emails = targetResult.rows.map((user) => String(user.email).toLowerCase());
  const dnsResult = await pool.query(
    `SELECT id, data
     FROM entity_records
     WHERE entity_type = 'DnsRecord'
       AND ((data->>'owner_id') = ANY($1::text[]) OR lower(data->>'owner_email') = ANY($2::text[]))`,
    [userIds, emails],
  );
  const cloudflareRecords = dnsResult.rows
    .map((row) => ({ id: row.id, ...(row.data || {}) }))
    .filter((record) => record.zone_id && record.cloudflare_record_id);
  await deleteCloudflareRecords(cloudflareRecords);

  const deleted = await transaction(async (client) => {
    const locked = await client.query('SELECT id FROM users WHERE id = ANY($1::uuid[]) FOR UPDATE', [userIds]);
    if (locked.rowCount !== userIds.length) throw Object.assign(new Error('One or more selected users no longer exist'), { status: 404 });

    await upsertDeletedUserTombstones(client, userDeletionTombstones(targetResult.rows, actor));

    const records = await client.query(
      `WITH target_records AS MATERIALIZED (
         SELECT id::text
         FROM entity_records
         WHERE
           (entity_type IN ('DnsRecord', 'SubdomainOwnership')
             AND ((data->>'owner_id') = ANY($1::text[]) OR lower(data->>'owner_email') = ANY($2::text[])))
           OR (entity_type IN ('SubdomainRequest', 'EditRequest')
             AND ((data->>'requester_id') = ANY($1::text[]) OR lower(data->>'requester_email') = ANY($2::text[])))
           OR (entity_type IN ('Donation', 'ApiToken', 'TrustedDevice', 'DeviceCode')
             AND ((data->>'user_id') = ANY($1::text[]) OR lower(data->>'user_email') = ANY($2::text[]) OR lower(data->>'email') = ANY($2::text[])))
           OR (entity_type = 'AbuseReport' AND lower(data->>'reporter_email') = ANY($2::text[]))
       ), related_records AS MATERIALIZED (
         SELECT id::text
         FROM entity_records
         WHERE
           (entity_type = 'RequestComment' AND (lower(data->>'author_email') = ANY($2::text[]) OR data->>'request_id' IN (SELECT id FROM target_records)))
           OR (entity_type = 'SafetyAssessment' AND data->>'request_id' IN (SELECT id FROM target_records))
           OR (entity_type = 'EmailLog' AND (lower(data->>'to') = ANY($2::text[]) OR data->>'related_entity_id' IN (SELECT id FROM target_records)))
       ), deleted AS (
         DELETE FROM entity_records
         WHERE id::text IN (SELECT id FROM target_records)
            OR id::text IN (SELECT id FROM related_records)
            OR (entity_type = 'AuditLog' AND (lower(data->>'actor_email') = ANY($2::text[])
              OR data->>'entity_id' IN (SELECT id FROM target_records)
              OR data->>'entity_id' IN (SELECT id FROM related_records)))
         RETURNING entity_type
       )
       SELECT entity_type, count(*)::integer AS count FROM deleted GROUP BY entity_type`,
      [userIds, emails],
    );

    // Retain global operational objects while removing references to the deleted identities.
    await client.query(
      `UPDATE entity_records
       SET created_by_id = NULL, created_by_email = NULL, data = data - 'created_by'
       WHERE created_by_id = ANY($1::uuid[]) OR lower(created_by_email) = ANY($2::text[])`,
      [userIds, emails],
    );
    await client.query(
      `UPDATE backup_runs SET created_by_id = NULL, created_by_email = NULL
       WHERE created_by_id = ANY($1::uuid[]) OR lower(created_by_email) = ANY($2::text[])`,
      [userIds, emails],
    );
    const users = await client.query('DELETE FROM users WHERE id = ANY($1::uuid[]) RETURNING id', [userIds]);
    return {
      users: users.rowCount,
      records: Object.fromEntries(records.rows.map((row) => [row.entity_type, row.count])),
    };
  });

  return { ...deleted, cloudflare_records: cloudflareRecords.length };
}
