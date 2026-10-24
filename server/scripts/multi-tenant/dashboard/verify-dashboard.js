// Verifies the dashboard on the TEST database against production, dataset by dataset.
//
//   cd server
//   node scripts/multi-tenant/dashboard/verify-dashboard.js [--samples 5]
//
// For each production dataset (production-datasets/*.sql) and the two MAIN views:
//   1. MIGRATION  the same production SQL on MAIN and on TEST       → is TEST's data complete?
//   2. NEW VIEW   the production SQL on MAIN vs the dash.* view on TEST → do the new queries agree?
// Both databases are only read (MAIN read-only session, TEST in READ ONLY transactions).
// Rows are compared on the dataset's columns (numbers rounded to 2 decimals, times to the second).
// For differing rows that carry an email, the student's tool rows are counted on both sides,
// which tells "TEST not synced yet / testers' rows" apart from "query logic differs".
// Report: scripts/multi-tenant/dashboard/last-verify-report.txt
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prod, test, closeAll } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const SAMPLES = args.includes('--samples') ? Number(args[args.indexOf('--samples') + 1]) : 3;
const VIEW_MAP = {
  v_ailabs_students_concept_explanationanalysis: 'students_concept_explanation_analysis',
  v_ailabs_phasewise_student_project_explanation_analysis: 'phasewise_project_explanation_analysis',
};

const roTest = async (sql, params) => {
  const c = await test.connect();
  try { await c.query('BEGIN READ ONLY'); const r = await c.query(sql, params); await c.query('COMMIT'); return r.rows; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
};
const roProd = async (sql, params) => (await prod.query(sql, params)).rows;

const norm = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 19);
  if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))) return String(Math.round(Number(v) * 100) / 100);
  return String(v).trim();
};
function compare(a, b, cols) {
  const key = (r) => cols.map((c) => norm(r[c])).join(' | ');
  const count = (rows) => rows.reduce((m, r) => m.set(key(r), (m.get(key(r)) || 0) + 1), new Map());
  const A = count(a), B = count(b);
  const onlyA = [...A].filter(([k, n]) => (B.get(k) || 0) < n).map(([k]) => k);
  const onlyB = [...B].filter(([k, n]) => (A.get(k) || 0) < n).map(([k]) => k);
  return { same: !onlyA.length && !onlyB.length, onlyA, onlyB };
}

// tool rows per email on each side (explains most data differences)
const EVIDENCE = `
  SELECT (SELECT count(*) FROM tbl_ailabs_ytfeedback_project_evaluation WHERE lower(trim(email)) = $1) AS yt_project,
         (SELECT count(*) FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE lower(trim(email)) = $1) AS yt_concept,
         (SELECT count(*) FROM tbl_ailabs_projectanalyzer_projects_af p JOIN tbl_ailabs_projectanalyzer_users_af u ON u."_id" = p."userId"
           WHERE lower(trim(u.email)) = $1) AS pa_projects,
         (SELECT count(*) FROM tbl_ailabs_projectanalyzer_projects_af p JOIN tbl_ailabs_projectanalyzer_users_af u ON u."_id" = p."userId"
           WHERE lower(trim(u.email)) = $1 AND p.status = 'completed') AS pa_completed`;

async function evidence(lines, cols, keys) {
  const ei = cols.indexOf('email');
  if (ei < 0) return;
  const emails = [...new Set(keys.map((k) => k.split(' | ')[ei].toLowerCase()).filter(Boolean))].slice(0, SAMPLES);
  for (const e of emails) {
    const [p] = await roProd(EVIDENCE, [e]);
    const [t] = await roTest(EVIDENCE, [e]);
    const f = (r) => `yt_project=${r.yt_project} yt_concept=${r.yt_concept} pa=${r.pa_projects} (completed ${r.pa_completed})`;
    lines.push(`        ${e}: MAIN ${f(p)}  |  TEST ${f(t)}${JSON.stringify(p) === JSON.stringify(t) ? '  (same data → query logic)' : '  (data differs)'}`);
  }
}

function report(lines, label, res, cols, aName, bName) {
  lines.push(`  ${res.same ? 'SAME' : 'DIFF'}  ${label}${res.same ? '' : `: ${res.onlyA.length} row(s) only in ${aName}, ${res.onlyB.length} only in ${bName}`}`);
  if (!res.same) {
    lines.push(`        columns: ${cols.join(' | ')}`);
    for (const k of res.onlyA.slice(0, SAMPLES)) lines.push(`        ${aName}: ${k}`);
    for (const k of res.onlyB.slice(0, SAMPLES)) lines.push(`        ${bName}: ${k}`);
  }
}

async function main() {
  const lines = [];
  const ro = (await roProd(`SELECT current_database() db, current_setting('transaction_read_only') ro`))[0];
  if (ro.ro !== 'on') throw new Error('Production session is not read-only; aborting');
  const tdb = (await roTest(`SELECT current_database() db`))[0].db;
  lines.push(`MAIN: ${ro.db} (read-only)   TEST: ${tdb} (read-only transactions)`);
  const runs = await roTest(`SELECT tool, max(finished_at) last FROM migration_sync_runs WHERE ok GROUP BY 1`).catch(() => []);
  lines.push(`last successful sync into TEST: ${runs.map((r) => `${r.tool} ${r.last?.toISOString()}`).join(', ') || 'none recorded'}`, '');

  let migSame = 0, newSame = 0, n = 0;
  const dir = path.join(__dirname, 'production-datasets');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    n++;
    const view = file.replace(/\.sql$/, '');
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const cols = text.match(/^-- columns: (.*)$/m)[1].split(', ');
    const sql = `SELECT * FROM (${text.replace(/^--.*$/gm, '').replace(/LIMIT 1000\b/g, 'LIMIT 10000000')}) x`;
    lines.push(`${view}`);
    const P = await roProd(sql);
    let T;
    try { T = await roTest(sql); } catch (e) { lines.push(`  FAIL  production SQL on TEST: ${e.message}`); T = null; }
    let D;
    try { D = await roTest(`SELECT * FROM dash.${view}`); } catch (e) { lines.push(`  FAIL  dash.${view}: ${e.message}`); D = null; }
    lines.push(`  rows: MAIN ${P.length}${T ? `, same SQL on TEST ${T.length}` : ''}${D ? `, dash.${view} ${D.length}` : ''}`);
    if (T) { const r = compare(P, T, cols); if (r.same) migSame++; report(lines, 'MIGRATION (same SQL)', r, cols, 'MAIN', 'TEST'); if (!r.same) await evidence(lines, cols, [...r.onlyA, ...r.onlyB]); }
    if (D) { const r = compare(P, D, cols); if (r.same) newSame++; report(lines, 'NEW VIEW', r, cols, 'MAIN', 'dash'); if (!r.same) await evidence(lines, cols, [...r.onlyA, ...r.onlyB]); }
    lines.push('');
  }
  for (const [pv, dv] of Object.entries(VIEW_MAP)) {
    n++;
    lines.push(`${pv}`);
    let P;
    try { P = await roProd(`SELECT * FROM public.${pv}`); } catch (e) { lines.push(`  FAIL  on MAIN: ${e.message}`, ''); continue; }
    const cols = P.length ? Object.keys(P[0]) : [];
    let T, D;
    try { T = await roTest(`SELECT * FROM public.${pv}`); } catch (e) { lines.push(`  FAIL  public.${pv} on TEST: ${e.message} (run copy-dashboard-tables.js)`); }
    try { D = await roTest(`SELECT * FROM dash.${dv}`); } catch (e) { lines.push(`  FAIL  dash.${dv}: ${e.message}`); }
    lines.push(`  rows: MAIN ${P.length}${T ? `, view on TEST ${T.length}` : ''}${D ? `, dash.${dv} ${D.length}` : ''}`);
    if (T) { const r = compare(P, T, cols); if (r.same) migSame++; report(lines, 'MIGRATION (same view)', r, cols, 'MAIN', 'TEST'); if (!r.same) await evidence(lines, cols, [...r.onlyA, ...r.onlyB]); }
    if (D) {
      const common = cols.filter((c) => D.length && c in D[0]);
      const r = compare(P, D, common); if (r.same) newSame++;
      report(lines, `NEW VIEW (columns ${common.length}/${cols.length})`, r, common, 'MAIN', 'dash');
      if (!r.same) await evidence(lines, common, [...r.onlyA, ...r.onlyB]);
    }
    lines.push('');
  }
  lines.push(`MIGRATION: ${migSame}/${n} identical    NEW VIEWS: ${newSame}/${n} identical`);
  lines.push('Expected differences: evaluations under OLD phase names (counted by the new views only), rows testers created in TEST,',
    'and Project Analyzer projects newer in TEST (synced from MongoDB) than in MAIN (Airflow copy). "(same data → query logic)" marks the rest.');
  return lines;
}

const t0 = Date.now();
main()
  .then((lines) => {
    const text = lines.join('\n') + `\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`;
    console.log(text);
    fs.writeFileSync(path.join(__dirname, 'last-verify-report.txt'), `${new Date().toISOString()}\n${text}\n`);
  })
  .catch((e) => { console.error('ERROR:', e.message); process.exitCode = 2; })
  .finally(() => closeAll());
