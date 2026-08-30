import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './database.js';

const here = dirname(fileURLToPath(import.meta.url));
const sql = await readFile(join(here, 'schema.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('Database schema is up to date.');
} finally {
  await pool.end();
}
