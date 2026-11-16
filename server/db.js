/**
 * Single PostgreSQL pool for the backend.
 *
 * DB_TARGET picks the database:
 *   test           → TEST_PG_*  (multi-tenant development database)
 *   prod           → PG_*       (main database, read/write; what EC2 uses today)
 *   prod-readonly  → PG_*       opened with default_transaction_read_only=on
 *
 * If DB_TARGET is not set:
 *   - TEST_PG_DATABASE present (developer machine) → test
 *   - otherwise (EC2 production, unchanged)        → prod
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Loaded here because ES module imports run before index.js calls dotenv.config().
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const env = (k) => (process.env[k] ?? '').trim();
const VALID = ['test', 'prod', 'prod-readonly'];

export const DB_TARGET = env('DB_TARGET') || (env('TEST_PG_DATABASE') ? 'test' : 'prod');
if (!VALID.includes(DB_TARGET)) {
  throw new Error(`Invalid DB_TARGET "${DB_TARGET}". Use one of: ${VALID.join(', ')}`);
}

const prefix = DB_TARGET === 'test' ? 'TEST_PG_' : 'PG_';
const config = {
  host: env(`${prefix}HOST`),
  port: Number(env(`${prefix}PORT`) || 5432),
  user: env(`${prefix}USER`),
  password: process.env[`${prefix}PASSWORD`],
  database: env(`${prefix}DATABASE`),
  ssl: env(`${prefix}SSL`) === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 10,
};
if (DB_TARGET === 'prod-readonly') config.options = '-c default_transaction_read_only=on';

if (DB_TARGET === 'test' && config.database && config.database === env('PG_DATABASE') && config.host === env('PG_HOST')) {
  throw new Error('DB_TARGET=test but TEST_PG_* points to the main database. Refusing to start.');
}

export const pgPool = new Pool(config);

pgPool.query('SELECT current_database() AS db, current_setting(\'transaction_read_only\') AS ro', (err, res) => {
  if (err) {
    console.error('PostgreSQL connection error:', err.message);
  } else {
    const { db, ro } = res.rows[0];
    console.log(`Connected to PostgreSQL: target=${DB_TARGET} database=${db} read_only=${ro}`);
  }
});

pgPool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
