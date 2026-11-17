// Creates / rebuilds the dashboard views (schema "dash") in the TEST database, one view per
// query in superset-queries/ (dash.campus_phase_progress = 01_campus_phase_progress.sql, …),
// so the views and the queries can never disagree.
//
//   cd server
//   node scripts/multi-tenant/dashboard/apply-dash-views.js                 # tables copied into TEST (default)
//   node scripts/multi-tenant/dashboard/apply-dash-views.js --src main_ro   # campus/student tables read live via 10-main-ro-fdw.sql
//
// Only TEST is written (one transaction), with the TEST_PG_* user. No roles or logins are created.
// Re-runnable: the dash schema is rebuilt each time.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, closeAll } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const src = args.includes('--src') ? args[args.indexOf('--src') + 1] : 'public';
if (!/^[a-z_][a-z0-9_]*$/.test(src)) throw new Error(`bad --src "${src}"`);

// query file → view name
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
    await c.query('COMMIT');
    console.log(`dash schema rebuilt in TEST: ${Object.keys(VIEWS).length} views from superset-queries/, campus/student tables read from "${src}"`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}
main().catch((e) => { console.error('ERROR:', e.message); process.exitCode = 2; }).finally(() => closeAll());
