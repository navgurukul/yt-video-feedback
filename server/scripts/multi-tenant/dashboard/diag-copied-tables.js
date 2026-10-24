// Read-only diagnostic: are the tables copy-dashboard-tables.js copied identical in MAIN and TEST?
// For each table: column names/types, row count, and a checksum of all rows (as text).
// For the student/campus tables also: rows per campus / status / school on both sides.
//   cd server && node scripts/multi-tenant/dashboard/diag-copied-tables.js
// Writes nothing to either database. Report: scripts/multi-tenant/dashboard/last-diag-report.txt
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prod, test, closeAll } from '../db.js';
// same list as copy-dashboard-tables.js (not imported: importing it would run the copy)
const DASHBOARD_TABLES = [
  'tbl_ghar_add_student', 'tbl_ghar_create_campus', 'tbl_ghar_assign_school_to_campus',
  'tbl_ghar_Write_Improve_Data', 'tbl_ghar_Speak_Improve_Data', 'tbl_ghar_apply_leave', 'tbl_ghar_leave_type',
  'tbl_ailabs_phasewise_parameter_weightages', 'tbl_ailabls_ytfeedback_phases', 'tbl_ailabls_ytfeedback_phasevideos',
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const q = (s) => '"' + s.replace(/"/g, '""') + '"';
const out = [];
const log = (...a) => { const s = a.join(' '); console.log(s); out.push(s); };

async function ro(pool, sql, params) {
  const c = await pool.connect();
  try {
    await c.query(`BEGIN READ ONLY`); await c.query(`SET LOCAL TIME ZONE 'UTC'`);
    const r = await c.query(sql, params); await c.query('COMMIT'); return r.rows;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}
const cols = (db, t) => ro(db, `SELECT column_name n, data_type || COALESCE('('||character_maximum_length||')','') t, ordinal_position p
  FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);

async function main() {
  log(new Date().toISOString());
  for (const db of [['MAIN', prod], ['TEST', test]])
    log(db[0], JSON.stringify((await ro(db[1], `SELECT current_database() d, current_user u, current_setting('search_path') sp`))[0]));
  for (const t of DASHBOARD_TABLES) {
    log('\n=== ' + t);
    const [cm, ct] = [await cols(prod, t), await cols(test, t)];
    const mm = new Map(cm.map((c) => [c.n, c.t])), tm = new Map(ct.map((c) => [c.n, c.t]));
    for (const [n, ty] of mm) if (tm.get(n) !== ty) log(`  column ${n}: MAIN ${ty}  TEST ${tm.get(n) ?? 'MISSING'}`);
    for (const [n, ty] of tm) if (!mm.has(n)) log(`  column ${n}: only in TEST (${ty})`);
    const exprs = cm.map((c) => `COALESCE(${q(c.n)}::text,'<null>')`).join(` || '|' || `);
    const sql = `SELECT count(*)::int n, md5(COALESCE(string_agg(r, E'\\n' ORDER BY r), '')) h FROM (SELECT ${exprs} r FROM public.${q(t)}) x`;
    const [a, b] = [(await ro(prod, sql))[0], (await ro(test, sql))[0]];
    log(`  rows MAIN ${a.n}  TEST ${b.n}   checksum ${a.h === b.h ? 'IDENTICAL' : 'DIFFERENT'}`);
    if (a.h !== b.h) {
      const rowsSql = `SELECT ${exprs} r FROM public.${q(t)}`;
      const [ra, rb] = [new Set((await ro(prod, rowsSql)).map((x) => x.r)), new Set((await ro(test, rowsSql)).map((x) => x.r))];
      const onlyA = [...ra].filter((x) => !rb.has(x)), onlyB = [...rb].filter((x) => !ra.has(x));
      log(`  distinct rows only in MAIN: ${onlyA.length}, only in TEST: ${onlyB.length}`);
      log(`  columns: ${cm.map((c) => c.n).join('|')}`);
      for (const x of onlyA.slice(0, 3)) log('   MAIN: ' + x.slice(0, 400));
      for (const x of onlyB.slice(0, 3)) log('   TEST: ' + x.slice(0, 400));
    }
  }
  log('\n=== students per campus / status / school (MAIN vs TEST)');
  const g = `SELECT COALESCE(c."Campus_Name", '?campus ' || s."Select_Campus"::text) campus, s."Status"::text st, TRIM(s."Select_School1")::text sch, count(*)::int n
    FROM public.tbl_ghar_add_student s LEFT JOIN public.tbl_ghar_create_campus c ON c."ID"::text = s."Select_Campus"::text GROUP BY 1,2,3`;
  const key = (r) => `${r.campus} | ${r.st} | ${r.sch}`;
  const [ga, gb] = [new Map((await ro(prod, g)).map((r) => [key(r), r.n])), new Map((await ro(test, g)).map((r) => [key(r), r.n]))];
  for (const k of [...new Set([...ga.keys(), ...gb.keys()])].sort())
    if (ga.get(k) !== gb.get(k)) log(`  ${k}: MAIN ${ga.get(k) ?? 0}  TEST ${gb.get(k) ?? 0}`);
  log('  (only differing groups listed)');
  log('\n=== objects named like the copied tables in other schemas of TEST');
  for (const r of await ro(test, `SELECT n.nspname, c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relname = ANY($1) AND n.nspname <> 'public'`, [DASHBOARD_TABLES])) log('  ' + JSON.stringify(r));
}
main().catch((e) => { log('ERROR: ' + e.message); process.exitCode = 2; })
  .finally(async () => { fs.writeFileSync(path.join(__dirname, 'last-diag-report.txt'), out.join('\n') + '\n'); await closeAll(); });
