import { pool } from './database.js';
import { hashPassword } from './security.js';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');

if (!email || password.length < 12) {
  console.error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.');
  process.exitCode = 1;
} else {
  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users(email, password_hash, role, status, email_verified_at)
     VALUES ($1, $2, 'admin', 'active', now())
     ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash, role = 'admin', status = 'active', email_verified_at = coalesce(users.email_verified_at, now()), updated_at = now()`,
    [email, passwordHash],
  );
  console.log(`Admin account ready: ${email}`);
}

await pool.end();
