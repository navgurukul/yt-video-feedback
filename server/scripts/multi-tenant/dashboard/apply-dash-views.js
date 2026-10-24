// Creates / rebuilds the dashboard views (schema "dash") in the TEST database.
//
//   cd server
//   node scripts/multi-tenant/dashboard/apply-dash-views.js                 # tables copied into TEST (default)
//   node scripts/multi-tenant/dashboard/apply-dash-views.js --src main_ro   # tables read live via 10-main-ro-fdw.sql
//   DASH_READER_PASSWORD='…' node scripts/multi-tenant/dashboard/apply-dash-views.js
//        # also creates/updates the read-only login "superset_dash" Superset uses: it can read the
//        # dash views and the tables the queries in superset-queries/ use (nothing else, no writes)
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

// [table, columns or null for all]
const READER_TABLES = [
  ['institutions', ['id', 'slug', 'name']], ['programs', null], ['phases', null], ['video_assignments', null],
  ['pa_phase_specs', null], ['legacy_phase_name_map', null],
  ['tbl_ailabs_ytfeedback_project_evaluation', null], ['tbl_ailabs_ytfeedback_concept_evaluations', null],
  ['tbl_ailabs_projectanalyzer_projects_af', ['_id', 'userId', 'phase', 'status', 'finalFeedback', 'createdAt', 'updatedAt', 'institution_id', 'pa_phase_spec_id']],
  ['tbl_ailabs_projectanalyzer_users_af', ['_id', 'email']],
  ['tbl_ghar_add_student', null], ['tbl_ghar_create_campus', null], ['tbl_ghar_assign_school_to_campus', null],
  ['tbl_ghar_Write_Improve_Data', null], ['tbl_ghar_Speak_Improve_Data', null], ['tbl_ghar_apply_leave', null],
  ['tbl_ghar_leave_type', null], ['tbl_ailabs_phasewise_parameter_weightages', null],
];

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
      // the standalone queries in superset-queries/ read these tables directly (read only);
      // column-level grants keep password hashes / API keys out of Superset's reach
      await c.query(`GRANT USAGE ON SCHEMA public TO superset_dash`);
      for (const [table, cols] of READER_TABLES) {
        const exists = (await c.query(`SELECT to_regclass('public.' || quote_ident($1)) t`, [table])).rows[0].t;
        if (!exists) continue;
        await c.query(`GRANT SELECT ${cols ? `(${cols.map((x) => `"${x}"`).join(', ')})` : ''} ON public."${table}" TO superset_dash`);
      }
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
