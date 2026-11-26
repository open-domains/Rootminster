import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.databasePoolSize,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  keepAlive: true,
  allowExitOnIdle: !config.production,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export const query = (text, values) => pool.query(text, values);

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withAdvisoryLock(key, callback) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [key]);
    if (!result.rows[0].locked) return { skipped: true };
    return await callback(client);
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [key]).catch(() => {});
    client.release();
  }
}
