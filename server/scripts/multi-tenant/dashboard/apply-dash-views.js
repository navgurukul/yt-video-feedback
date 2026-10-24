// Creates / rebuilds the dashboard views (schema "dash") in the TEST database.
//
//   cd server
//   node scripts/multi-tenant/dashboard/apply-dash-views.js                 # tables copied into TEST (default)
//   node scripts/multi-tenant/dashboard/apply-dash-views.js --src main_ro   # tables read live via 10-main-ro-fdw.sql
//   DASH_READER_PASSWORD='…' node scripts/multi-tenant/dashboard/apply-dash-views.js
//        # also creates/updates the read-only login "superset_dash" Superset uses
//
// Only TEST is written (one transaction). Re-runnable: the dash schema is rebuilt each time.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, closeAll } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const src = args.includes('--src') ? args[args.indexOf('--src') + 1] : 'public';
if (!/^[a-z_][a-z0-9_]*$/.test(src)) throw new Error(`bad --src "${src}"`);

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'dash-views.sql'), 'utf8').replaceAll('@src@', src);
  const c = await test.connect();
  try {
    await c.query('BEGIN');
    await c.query(sql);
    const pw = process.env.DASH_READER_PASSWORD;
    if (pw) {
      const db = (await c.query('SELECT current_database() d')).rows[0].d;
      const lit = (s) => "'" + s.replace(/'/g, "''") + "'";
      await c.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superset_dash') THEN CREATE ROLE superset_dash LOGIN; END IF; END $$`);
      await c.query(`ALTER ROLE superset_dash WITH LOGIN PASSWORD ${lit(pw)}`);
      await c.query(`ALTER ROLE superset_dash SET default_transaction_read_only = on`);
      await c.query(`ALTER ROLE superset_dash SET search_path = dash`);
      await c.query(`ALTER ROLE superset_dash SET statement_timeout = '120s'`);
      await c.query(`GRANT CONNECT ON DATABASE "${db.replace(/"/g, '""')}" TO superset_dash`);
      await c.query(`GRANT USAGE ON SCHEMA dash TO superset_dash`);
      await c.query(`GRANT SELECT ON ALL TABLES IN SCHEMA dash TO superset_dash`);
    }
    await c.query('COMMIT');
    const views = (await c.query(`SELECT count(*)::int n FROM information_schema.views WHERE table_schema = 'dash'`)).rows[0].n;
    console.log(`dash schema rebuilt in TEST: ${views} views, campus/student tables read from "${src}"${pw ? '; login superset_dash updated' : ''}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}
main().catch((e) => { console.error('ERROR:', e.message); process.exitCode = 2; }).finally(() => closeAll());
