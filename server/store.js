import { pool, transaction } from './database.js';

export const ENTITY_NAMES = new Set([
  'AuditLog', 'SubdomainOwnership', 'SyncLog', 'Domain', 'SubdomainRequest',
  'AbuseReport', 'PlatformSettings', 'RequestComment',
  'TrustedDevice', 'CleanupMigrationState', 'EmailLog', 'Donation', 'DeviceCode',
  'DnsRecord', 'ApiToken', 'BlocklistEntry', 'EditRequest', 'User',
  'SafetyAssessment', 'InstalledModule',
]);

const USER_COLUMNS = new Set([
  'email', 'password_hash', 'full_name', 'display_name', 'role', 'status',
  'email_verified_at', 'tos_accepted_at', 'tos_accepted_version', 'ns_unlocked', 'legacy_donor',
  'disable_email_notifications', 'totp_secret', 'totp_enabled', 'metadata',
]);

function assertEntity(entity) {
  if (!ENTITY_NAMES.has(entity)) throw Object.assign(new Error(`Unknown entity: ${entity}`), { status: 404 });
}

function serializeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    display_name: row.display_name,
    role: row.role,
    status: row.status,
    email_verified_at: row.email_verified_at?.toISOString?.() || row.email_verified_at,
    tos_accepted_at: row.tos_accepted_at?.toISOString?.() || row.tos_accepted_at,
    tos_accepted_version: row.tos_accepted_version,
    ns_unlocked: row.ns_unlocked,
    legacy_donor: row.legacy_donor,
    disable_email_notifications: row.disable_email_notifications,
    totp_secret: row.totp_secret,
    totp_enabled: row.totp_enabled,
    ...(row.metadata || {}),
    created_date: row.created_at?.toISOString?.() || row.created_at,
    updated_date: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function serializeRecord(row) {
  if (!row) return null;
  return {
    ...(row.data || {}),
    id: row.id,
    created_by: row.created_by_email || row.data?.created_by,
    created_date: row.created_at?.toISOString?.() || row.created_at,
    updated_date: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function normalSort(sort) {
  const raw = String(sort || '-created_date');
  const descending = raw.startsWith('-');
  const field = raw.replace(/^-/, '');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) return { field: 'created_date', descending: true };
  return { field, descending };
}

function recordFilterSql(filter, values) {
  const clauses = [];
  for (const [key, expected] of Object.entries(filter || {})) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
    if (key === 'id') {
      values.push(String(expected));
      clauses.push(`id = $${values.length}::uuid`);
      continue;
    }
    if (key === 'created_date' || key === 'updated_date') {
      values.push(expected);
      clauses.push(`${key === 'created_date' ? 'created_at' : 'updated_at'} = $${values.length}::timestamptz`);
      continue;
    }
    values.push(key);
    const keyParam = `$${values.length}`;
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Array.isArray(expected.$in)) {
        values.push(expected.$in.map(String));
        clauses.push(`data ->> ${keyParam} = ANY($${values.length}::text[])`);
      } else if ('$ne' in expected) {
        values.push(JSON.stringify(expected.$ne));
        clauses.push(`data -> ${keyParam} IS DISTINCT FROM $${values.length}::jsonb`);
      } else if ('$exists' in expected) {
        clauses.push(expected.$exists ? `data ? ${keyParam}` : `NOT (data ? ${keyParam})`);
      } else {
        values.push(JSON.stringify(expected));
        clauses.push(`data -> ${keyParam} = $${values.length}::jsonb`);
      }
    } else {
      values.push(JSON.stringify(expected));
      clauses.push(`data -> ${keyParam} = $${values.length}::jsonb`);
    }
  }
  return clauses;
}

function userMatches(user, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = user[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Array.isArray(expected.$in)) return expected.$in.includes(actual);
      if ('$ne' in expected) return actual !== expected.$ne;
      if ('$exists' in expected) return expected.$exists ? actual !== undefined && actual !== null : actual === undefined || actual === null;
    }
    return actual === expected;
  });
}

async function listUsers(filter, sort, limit, skip, executor = pool) {
  const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 10_000);
  const result = await executor.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 10000');
  const { field, descending } = normalSort(sort);
  const rows = result.rows.map(serializeUser).filter((row) => userMatches(row, filter));
  rows.sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    return String(av).localeCompare(String(bv)) * (descending ? -1 : 1);
  });
  return rows.slice(Number(skip) || 0, (Number(skip) || 0) + safeLimit);
}

export const store = {
  async list(entity, sort, limit = 1000, skip = 0, executor = pool) {
    return this.filter(entity, {}, sort, limit, skip, executor);
  },

  async filter(entity, filter = {}, sort, limit = 1000, skip = 0, executor = pool) {
    assertEntity(entity);
    if (entity === 'User') return listUsers(filter, sort, limit, skip, executor);

    const values = [entity];
    const clauses = ['entity_type = $1'];
    clauses.push(...recordFilterSql(filter, values));
    const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 10_000);
    const safeSkip = Math.max(Number(skip) || 0, 0);
    const { field, descending } = normalSort(sort);
    let order;
    if (field === 'created_date') order = 'created_at';
    else if (field === 'updated_date') order = 'updated_at';
    else if (field === 'id') order = 'id';
    else {
      values.push(field);
      order = `data ->> $${values.length}`;
    }
    values.push(safeLimit, safeSkip);
    const result = await executor.query(
      `SELECT * FROM entity_records WHERE ${clauses.join(' AND ')} ORDER BY ${order} ${descending ? 'DESC' : 'ASC'} NULLS LAST LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return result.rows.map(serializeRecord);
  },

  async get(entity, id, executor = pool) {
    assertEntity(entity);
    if (entity === 'User') {
      const result = await executor.query('SELECT * FROM users WHERE id = $1', [id]);
      return serializeUser(result.rows[0]);
    }
    const result = await executor.query('SELECT * FROM entity_records WHERE entity_type = $1 AND id = $2', [entity, id]);
    return serializeRecord(result.rows[0]);
  },

  async create(entity, data, actor = null, executor = pool) {
    assertEntity(entity);
    if (entity === 'User') throw Object.assign(new Error('Users must be created through authentication'), { status: 400 });
    const clean = { ...(data || {}) };
    delete clean.id;
    delete clean.created_date;
    delete clean.updated_date;
    const result = await executor.query(
      `INSERT INTO entity_records(entity_type, data, created_by_id, created_by_email)
       VALUES ($1, $2::jsonb, $3, $4) RETURNING *`,
      [entity, JSON.stringify(clean), actor?.id || null, actor?.email || clean.created_by || null],
    );
    return serializeRecord(result.rows[0]);
  },

  async bulkCreate(entity, rows, actor = null) {
    assertEntity(entity);
    if (!Array.isArray(rows) || rows.length > 1000) throw Object.assign(new Error('Bulk rows must be an array of at most 1000 items'), { status: 400 });
    return transaction(async (client) => {
      const created = [];
      for (const row of rows) created.push(await this.create(entity, row, actor, client));
      return created;
    });
  },

  async update(entity, id, data, executor = pool) {
    assertEntity(entity);
    if (entity === 'User') {
      const clean = {};
      const metadata = {};
      for (const [key, value] of Object.entries(data || {})) {
        if (USER_COLUMNS.has(key)) clean[key] = value;
        else if (!['id', 'created_date', 'updated_date', 'email'].includes(key)) metadata[key] = value;
      }
      const fields = [];
      const values = [];
      for (const [key, value] of Object.entries(clean)) {
        values.push(key === 'metadata' ? JSON.stringify(value || {}) : value);
        fields.push(`${key} = $${values.length}${key === 'metadata' ? '::jsonb' : ''}`);
      }
      if (Object.keys(metadata).length) {
        values.push(JSON.stringify(metadata));
        fields.push(`metadata = metadata || $${values.length}::jsonb`);
      }
      if (!fields.length) return this.get(entity, id, executor);
      values.push(id);
      const result = await executor.query(
        `UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
        values,
      );
      return serializeUser(result.rows[0]);
    }
    const clean = { ...(data || {}) };
    delete clean.id;
    delete clean.created_date;
    delete clean.updated_date;
    const result = await executor.query(
      `UPDATE entity_records SET data = data || $3::jsonb, updated_at = now()
       WHERE entity_type = $1 AND id = $2 RETURNING *`,
      [entity, id, JSON.stringify(clean)],
    );
    return serializeRecord(result.rows[0]);
  },

  async delete(entity, id, executor = pool) {
    assertEntity(entity);
    if (entity === 'User') {
      const result = await executor.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
      return serializeUser(result.rows[0]);
    }
    const result = await executor.query('DELETE FROM entity_records WHERE entity_type = $1 AND id = $2 RETURNING *', [entity, id]);
    return serializeRecord(result.rows[0]);
  },
};

export { serializeUser };
