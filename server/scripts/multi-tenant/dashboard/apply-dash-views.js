// Creates / rebuilds the dashboard views (schema "dash") in the TEST database, one view per
// query in superset-queries/ (dash.campus_phase_progress = 01_campus_phase_progress.sql, …),
// so the views and the queries can never disagree.
//
//   cd server
//   node scripts/multi-tenant/dashboard/apply-dash-views.js                 # tables copied into TEST (default)
//   node scripts/multi-tenant/dashboard/apply-dash-views.js --src main_ro   # campus/student tables read live via 10-main-ro-fdw.sql
//   DASH_READER_PASSWORD='…' node scripts/multi-tenant/dashboard/apply-dash-views.js
//        # also creates/updates the read-only login "superset_dash" Superset uses: it can read the
//        # dash views and the columns the queries in superset-queries/ use (nothing else, no writes)
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

// query file → view name (the view names the Superset bundle and older notes use)
const VIEWS = {
  '01_campus_phase_progress': 'campus_phase_progress',
  '02_campus_phase_timeline_score': 'campus_phase_timeline_score',
  '03_student_phase_submission_details': 'phase_submission_student_details',
  '04_student_missing_phase_submission_details': 'student_missing_phase_submissions',
  '05_student_current_phase_and_phase_scores': 'student_current_phase_scores',
  '06_concept_explanation_summary_view': 'concept_explanation_summary',
  '07_students_concept_explanation_analysis': 'students_concept_explanation_analysis',
  '08_phasewise_student_project_explanation_analysis': 'phasewise_project_explanation_analysis',
  '09_weekly_campus_learning': 'weekly_campus_summary',
};
// tables copied from MAIN (or read live with --src main_ro)
const MAIN_TABLES = ['tbl_ghar_add_student', 'tbl_ghar_create_campus', 'tbl_ghar_assign_school_to_campus',
  'tbl_ghar_Write_Improve_Data', 'tbl_ghar_Speak_Improve_Data', 'tbl_ghar_apply_leave', 'tbl_ghar_leave_type',
  'tbl_ailabs_phasewise_parameter_weightages', 'tbl_ailabls_ytfeedback_phases', 'tbl_ailabls_ytfeedback_phasevideos'];
// [table, columns or null for all] the read-only login may read
const READER_TABLES = [
  ['institutions', ['id', 'slug', 'name']], ['programs', null], ['phases', null], ['video_assignments', null],
  ['pa_phase_specs', null],
  ['tbl_ailabs_ytfeedback_project_evaluation', null], ['tbl_ailabs_ytfeedback_concept_evaluations', null],
  ['tbl_ailabs_projectanalyzer_projects_af', ['_id', 'userId', 'phase', 'status', 'finalFeedback', 'createdAt', 'updatedAt', 'institution_id', 'pa_phase_spec_id']],
  ['tbl_ailabs_projectanalyzer_users_af', ['_id', 'email']],
  ...MAIN_TABLES.map((t) => [t, null]),
];

function viewSql(file) {
  let sql = fs.readFileSync(path.join(__dirname, 'superset-queries', `${file}.sql`), 'utf8').trim().replace(/;\s*$/, '');
  if (src !== 'public') {
    for (const t of MAIN_TABLES) sql = sql.split(`public."${t}"`).join(`${src}."${t}"`).split(`public.${t}`).join(`${src}.${t}`);
  }
  return sql;
}

async function main() {
  const c = await test.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL client_min_messages = warning`);
    await c.query(`DROP SCHEMA IF EXISTS dash CASCADE`);
    await c.query(`CREATE SCHEMA dash`);
    for (const [file, view] of Object.entries(VIEWS)) {
      try {
        await c.query(`CREATE VIEW dash."${view}" AS\n${viewSql(file)}`);
      } catch (e) {
        throw new Error(`${file}.sql: ${e.message}`);
      }
    }
    const pw = process.env.DASH_READER_PASSWORD;
    if (pw) {
      const db = (await c.query('SELECT current_database() d')).rows[0].d;
      const lit = (s) => "'" + s.replace(/'/g, "''") + "'";
      await c.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superset_dash') THEN CREATE ROLE superset_dash LOGIN; END IF; END $$`);
      await c.query(`ALTER ROLE superset_dash WITH LOGIN PASSWORD ${lit(pw)}`);
      await c.query(`ALTER ROLE superset_dash SET default_transaction_read_only = on`);
      await c.query(`ALTER ROLE superset_dash SET search_path = public, dash`);
      await c.query(`ALTER ROLE superset_dash SET statement_timeout = '120s'`);
      await c.query(`GRANT CONNECT ON DATABASE "${db.replace(/"/g, '""')}" TO superset_dash`);
      await c.query(`GRANT USAGE ON SCHEMA dash, public TO superset_dash`);
      await c.query(`GRANT SELECT ON ALL TABLES IN SCHEMA dash TO superset_dash`);
      for (const [table, cols] of READER_TABLES) {
        const exists = (await c.query(`SELECT to_regclass('public.' || quote_ident($1)) t`, [table])).rows[0].t;
        if (!exists) continue;
        await c.query(`GRANT SELECT ${cols ? `(${cols.map((x) => `"${x}"`).join(', ')})` : ''} ON public."${table}" TO superset_dash`);
      }
    }
    await c.query('COMMIT');
    console.log(`dash schema rebuilt in TEST: ${Object.keys(VIEWS).length} views from superset-queries/, campus/student tables read from "${src}"${pw ? '; login superset_dash updated' : ''}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}
main().catch((e) => { console.error('ERROR:', e.message); process.exitCode = 2; }).finally(() => closeAll());
