// Copies the non-tool tables the Campus Learning Dashboard reads (students, campuses, schools,
// leave, English grades, weightages, legacy phase tables) and its two MAIN views from production
// into the TEST database, so every dashboard query can run on TEST alone.
//
//   cd server
//   node scripts/multi-tenant/dashboard/copy-dashboard-tables.js            # copy / refresh
//   node scripts/multi-tenant/dashboard/copy-dashboard-tables.js --dry-run  # only report
//
// * Production (PG_* in server/.env) is opened READ ONLY; only TEST_PG_* is written.
// * Re-runnable: rows are synced with the same ledger as cutover/sync-from-main.js, with MAIN
//   always winning for these tables (nothing edits them in TEST). Tables without a primary key
//   are replaced as a whole, inside one transaction.
// * The YT / Project Analyzer tables are NOT copied: TEST has its own (newer, multi-tenant) ones.
// * The two views are re-created in TEST from their production definitions
//   (pg_get_viewdef); any table they need that TEST lacks is copied too.
// Run it together with the daily sync until the switch (the ghar tables keep changing in MAIN).
// Report: scripts/multi-tenant/dashboard/last-copy-report.txt
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { prod, test, closeAll } from '../db.js';

const require = createRequire(import.meta.url);
const core = require('../cutover/sync-core.cjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');

export const DASHBOARD_TABLES = [
  'tbl_ghar_add_student', 'tbl_ghar_create_campus', 'tbl_ghar_assign_school_to_campus',
  'tbl_ghar_Write_Improve_Data', 'tbl_ghar_Speak_Improve_Data', 'tbl_ghar_apply_leave', 'tbl_ghar_leave_type',
  'tbl_ailabs_phasewise_parameter_weightages', 'tbl_ailabls_ytfeedback_phases', 'tbl_ailabls_ytfeedback_phasevideos',
];
export const DASHBOARD_VIEWS = ['v_ailabs_students_concept_explanationanalysis', 'v_ailabs_phasewise_student_project_explanation_analysis'];
// tool tables: TEST keeps its own; never overwritten from MAIN
const TOOL_TABLE = /^(tbl_ailabs_ytfeedback_|tbl_ailabs_projectanalyzer_|tbl_manual_video_evaluations$|tbl_llm_api_calls$|tbl_user_issues$|tbl_failed_requests$)/;
const q = core.q;
const exists = async (db, name, kinds = ['r', 'v', 'm', 'f', 'p']) =>
  (await db.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = ANY($2)`, [name, kinds])).rowCount > 0;

/** Whole-table replace for tables without a primary key. */
async function replaceTable(table, lines) {
  const meta = await core.tableMeta(prod, table);
  if (dryRun) { lines.push(`${table}: no primary key — would be replaced as a whole`); return; }
  await core.ensureTestTable(test, table, meta);
  const list = meta.cols.map((c) => q(c.name)).join(', ');
  const c = await test.connect();
  let n = 0;
  try {
    await c.query('BEGIN');
    await c.query(`TRUNCATE ${q(table)}`);
    for (let off = 0; ; off += 2000) {
      // JSON stays text end to end: parsing it in Node would round the 18-digit ids
      // (163704000001683717 -> 163704000001683700) and break every join on them
      const page = (await core.withUtc(prod, (p) => p.query(
        `SELECT COALESCE(json_agg(t), '[]'::json)::text d, count(*)::int n FROM (SELECT ${list} FROM public.${q(table)} ORDER BY ${list} LIMIT 2000 OFFSET ${off}) t`))).rows[0];
      if (!page.n) break;
      await c.query(`INSERT INTO ${q(table)} (${list}) SELECT ${list} FROM json_populate_recordset(NULL::${q(table)}, $1::json)`, [page.d]);
      n += page.n;
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  lines.push(`${table}: replaced (no primary key), ${n} rows`);
}

async function copyTable(table, lines) {
  if (!(await exists(prod, table, ['r', 'p']))) { lines.push(`${table}: not a table in MAIN — skipped`); return; }
  const r = await core.syncPgTable(prod, test, table, {
    dryRun, sourceWins: true, applyDeletes: true, mirror: true, identity: false, headroom: false,
  });
  if (r.skipped?.startsWith('no primary key')) return replaceTable(table, lines);
  lines.push(`${table}: ${core.summaryLine(r)}`);
  for (const n of r.notes || []) lines.push(`    note: ${n}`);
}

/** Views (and views they use), deepest first, with the tables they read. */
async function viewTree(view, seen = new Map()) {
  if (seen.has(view)) return seen;
  const def = (await prod.query(`SELECT pg_get_viewdef(('public.' || quote_ident($1))::regclass, true) d`, [view])).rows[0].d;
  const deps = (await prod.query(
    `SELECT DISTINCT c2.relname, c2.relkind FROM pg_rewrite r
       JOIN pg_depend d ON d.objid = r.oid AND d.classid = 'pg_rewrite'::regclass
       JOIN pg_class c2 ON c2.oid = d.refobjid
       JOIN pg_namespace n ON n.oid = c2.relnamespace
      WHERE r.ev_class = ('public.' || quote_ident($1))::regclass AND c2.relname <> $1 AND n.nspname = 'public'`, [view])).rows;
  for (const d of deps.filter((x) => x.relkind === 'v')) await viewTree(d.relname, seen);
  seen.set(view, { def, tables: deps.filter((x) => x.relkind !== 'v').map((x) => x.relname), views: deps.filter((x) => x.relkind === 'v').map((x) => x.relname) });
  return seen;
}

async function main() {
  const lines = [];
  const p = (await prod.query(`SELECT current_database() db, current_setting('transaction_read_only') ro`)).rows[0];
  const t = (await test.query(`SELECT current_database() db`)).rows[0];
  if (p.ro !== 'on') throw new Error('Production session is not read-only; aborting');
  lines.push(`MAIN: ${p.db} (read-only)   TEST: ${t.db}${dryRun ? '   [dry run]' : ''}`, '');
  await core.ensureLedger(test);

  lines.push('Tables (MAIN → TEST, MAIN wins):');
  for (const table of DASHBOARD_TABLES) await copyTable(table, lines);

  lines.push('', 'Views (definitions from MAIN):');
  const defsDir = path.join(__dirname, 'production-views');
  fs.mkdirSync(defsDir, { recursive: true });
  for (const view of DASHBOARD_VIEWS) {
    if (!(await exists(prod, view, ['v']))) { lines.push(`${view}: not a view in MAIN — skipped`); continue; }
    const tree = await viewTree(view);
    for (const [name, info] of tree) {
      for (const table of info.tables) {
        if (await exists(test, table)) continue;
        if (TOOL_TABLE.test(table)) { lines.push(`${name}: needs ${table}, which TEST lacks (tool table, not copied)`); continue; }
        lines.push(`${name} needs ${table} (missing in TEST):`);
        await copyTable(table, lines);
      }
      fs.writeFileSync(path.join(defsDir, `${name}.sql`),
        `-- production definition of public.${name} (read with pg_get_viewdef)\n-- reads: ${[...info.tables, ...info.views].join(', ')}\nCREATE OR REPLACE VIEW public.${q(name)} AS\n${info.def}\n`);
      if (dryRun) { lines.push(`${name}: would be (re)created (reads ${[...info.tables, ...info.views].join(', ')})`); continue; }
      const c = await test.connect();
      try {
        await c.query('BEGIN');
        await c.query(`DROP VIEW IF EXISTS public.${q(name)} CASCADE`);
        await c.query(`CREATE VIEW public.${q(name)} AS ${info.def}`);
        await c.query('COMMIT');
        lines.push(`${name}: created in TEST (reads ${[...info.tables, ...info.views].join(', ')})`);
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        lines.push(`${name}: NOT created — ${e.message}`);
      } finally { c.release(); }
    }
  }
  lines.push('', `definitions saved in ${path.relative(process.cwd(), defsDir)}/`);
  return lines;
}

const t0 = Date.now();
main()
  .then((lines) => {
    const text = lines.join('\n') + `\n\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`;
    console.log(text);
    fs.writeFileSync(path.join(__dirname, dryRun ? 'last-copy-dry-run.txt' : 'last-copy-report.txt'), `${new Date().toISOString()}\n${text}\n`);
  })
  .catch((e) => { console.error('ERROR:', e.message); process.exitCode = 2; })
  .finally(() => closeAll());
