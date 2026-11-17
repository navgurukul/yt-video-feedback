// Builds a fresh rehearsal copy of MAIN in the SCRATCH database: the legacy tables only,
// exactly as they are in MAIN today (no tenant columns, no config tables).
// MAIN is read in a READ-ONLY session.
//
//   1. Create an empty database, e.g. "scratch_ghar_central_db", on the same server
//   2. Add SCRATCH_PG_HOST / _PORT / _USER / _PASSWORD / _DATABASE / _SSL to server/.env
//   3. node scripts/multi-tenant/promote/make-scratch.js
//   4. node scripts/multi-tenant/promote/promote.js --target scratch
//
// Safety: the scratch database name must contain "scratch" and differ from MAIN and TEST,
// because this script DROPS every table in its public schema first.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pkg from 'pg';
import { LEGACY_TABLES, mirrorTable, copyRows } from '../03-copy-from-prod.js';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const env = (k) => (process.env[k] ?? '').trim();
const ssl = (v) => (v === 'true' ? { rejectUnauthorized: false } : false);
const poolFor = (prefix, readOnly = false) => new Pool({
  host: env(`${prefix}HOST`), port: Number(env(`${prefix}PORT`) || 5432), user: env(`${prefix}USER`),
  password: process.env[`${prefix}PASSWORD`], database: env(`${prefix}DATABASE`), ssl: ssl(env(`${prefix}SSL`)),
  max: 3, connectionTimeoutMillis: 20000, ...(readOnly ? { options: '-c default_transaction_read_only=on' } : {}),
});

const name = env('SCRATCH_PG_DATABASE');
if (!name || !name.includes('scratch') || name === env('PG_DATABASE') || name === env('TEST_PG_DATABASE')) {
  console.error('SCRATCH_PG_DATABASE must be set, contain "scratch", and differ from PG_DATABASE and TEST_PG_DATABASE.');
  process.exit(1);
}

const main = poolFor('PG_', true);
const scratch = poolFor('SCRATCH_PG_');
try {
  const ro = (await main.query(`SELECT current_setting('transaction_read_only') AS ro`)).rows[0].ro;
  if (ro !== 'on') throw new Error('MAIN session is not read-only; aborting');
  const db = (await scratch.query('SELECT current_database() AS d')).rows[0].d;
  console.log(`Rebuilding ${db} from MAIN (read-only) …`);

  const tables = (await scratch.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).rows.map((r) => r.tablename);
  if (tables.length) await scratch.query(`DROP TABLE ${tables.map((t) => `public."${t}"`).join(', ')} CASCADE`);
  await scratch.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  for (const t of LEGACY_TABLES) {
    const meta = await mirrorTable(main, scratch, t, console.log, { tenantColumns: false });
    if (meta) await copyRows(main, scratch, t, meta.cols, meta.pk, console.log);
  }
  console.log('\nScratch copy ready. Next: node scripts/multi-tenant/promote/promote.js --target scratch');
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await main.end();
  await scratch.end();
}
