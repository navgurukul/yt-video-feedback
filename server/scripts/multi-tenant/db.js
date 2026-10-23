// Shared DB connections for the multi-tenant migration scripts.
// PROD is opened in a READ-ONLY session: Postgres itself rejects any write.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ssl = (v) => String(v || '').trim() === 'true' ? { rejectUnauthorized: false } : false;

export const prod = new Pool({
  host: process.env.PG_HOST?.trim(),
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER?.trim(),
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE?.trim(),
  ssl: ssl(process.env.PG_SSL),
  max: 2,
  options: '-c default_transaction_read_only=on',
});

export const test = new Pool({
  host: process.env.TEST_PG_HOST?.trim(),
  port: Number(process.env.TEST_PG_PORT || 5432),
  user: process.env.TEST_PG_USER?.trim(),
  password: process.env.TEST_PG_PASSWORD,
  database: process.env.TEST_PG_DATABASE?.trim(),
  ssl: ssl(process.env.TEST_PG_SSL),
  max: 4,
});

if (prod.options.database === test.options.database && prod.options.host === test.options.host) {
  throw new Error('Refusing to run: TEST_PG_* points to the same database as PG_*');
}

export async function closeAll() { await prod.end(); await test.end(); }
