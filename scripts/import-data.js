import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool, transaction } from '../server/database.js';
import { ENTITY_NAMES } from '../server/store.js';

const source = process.argv[2];
if (!source) {
  console.error('Usage: npm run db:import -- <export.json|->');
  process.exit(1);
}

const raw = source === '-'
  ? await new Promise((resolve, reject) => {
      let value = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { value += chunk; });
      process.stdin.on('end', () => resolve(value));
      process.stdin.on('error', reject);
    })
  : await readFile(source, 'utf8');

const parsed = JSON.parse(raw);
const input = parsed.entities || parsed;
const userRows = input.User || input.users || [];
const entityRows = Object.entries(input)
  .filter(([name, rows]) => ENTITY_NAMES.has(name) && name !== 'User' && Array.isArray(rows));

const imported = await transaction(async (client) => {
  const userIds = new Map();
  const recordIds = new Map();
  let users = 0;
  let records = 0;

  for (const sourceUser of userRows) {
    const email = String(sourceUser.email || sourceUser.created_by || '').trim().toLowerCase();
    if (!email) continue;
    const result = await client.query(
      `INSERT INTO users(email, full_name, display_name, role, status, email_verified_at, tos_accepted_at,
        ns_unlocked, legacy_donor, disable_email_notifications, totp_enabled, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'active',now(),$5,$6,$7,$8,false,$9::jsonb,$10,$11)
       ON CONFLICT (email) DO UPDATE SET
         full_name = coalesce(excluded.full_name, users.full_name),
         display_name = coalesce(excluded.display_name, users.display_name),
         role = excluded.role,
         ns_unlocked = excluded.ns_unlocked,
         legacy_donor = excluded.legacy_donor,
         disable_email_notifications = excluded.disable_email_notifications,
         updated_at = now()
       RETURNING id`,
      [
        email,
        sourceUser.full_name || null,
        sourceUser.display_name || null,
        ['user', 'staff', 'admin'].includes(sourceUser.role) ? sourceUser.role : 'user',
        sourceUser.tos_accepted_at || null,
        !!sourceUser.ns_unlocked,
        !!sourceUser.legacy_donor,
        !!sourceUser.disable_email_notifications,
        JSON.stringify({ legacy_id: sourceUser.id || null }),
        sourceUser.created_date || new Date(),
        sourceUser.updated_date || sourceUser.created_date || new Date(),
      ],
    );
    if (sourceUser.id) userIds.set(String(sourceUser.id), result.rows[0].id);
    users += 1;
  }

  for (const [entity, rows] of entityRows) {
    const map = new Map();
    for (const row of rows) if (row.id) map.set(String(row.id), crypto.randomUUID());
    recordIds.set(entity, map);
  }

  const userReferenceFields = new Set(['owner_id', 'requester_id', 'user_id']);
  const entityReferenceFields = {
    dns_record_id: ['DnsRecord'],
    request_id: ['SubdomainRequest', 'EditRequest'],
    related_entity_id: ['SubdomainRequest', 'DnsRecord', 'Donation', 'AbuseReport'],
  };

  for (const [entity, rows] of entityRows) {
    for (const sourceRow of rows) {
      const data = { ...sourceRow, legacy_id: sourceRow.id || null };
      delete data.id;
      delete data.created_date;
      delete data.updated_date;
      for (const field of userReferenceFields) {
        if (data[field] && userIds.has(String(data[field]))) data[field] = userIds.get(String(data[field]));
      }
      for (const [field, targets] of Object.entries(entityReferenceFields)) {
        if (!data[field]) continue;
        for (const target of targets) {
          const replacement = recordIds.get(target)?.get(String(data[field]));
          if (replacement) {
            data[field] = replacement;
            break;
          }
        }
      }
      const id = recordIds.get(entity)?.get(String(sourceRow.id)) || crypto.randomUUID();
      const createdById = sourceRow.created_by && userIds.get(String(sourceRow.created_by));
      await client.query(
        `INSERT INTO entity_records(id, entity_type, data, created_by_id, created_by_email, created_at, updated_at)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [id, entity, JSON.stringify(data), createdById || null, sourceRow.created_by_email || sourceRow.created_by || null, sourceRow.created_date || new Date(), sourceRow.updated_date || sourceRow.created_date || new Date()],
      );
      records += 1;
    }
  }
  return { users, records };
});

console.log(`Imported ${imported.users} users and ${imported.records} records.`);
console.log('Imported users must use password reset before signing in with email and password.');
await pool.end();
