// OLD vs NEW dashboard queries, compared cell by cell.
//
//   cd server
//   node scripts/multi-tenant/dashboard/compare-old-new.js [--samples 10]
//
// For every dashboard component it runs
//   OLD@MAIN  the production query (production-datasets/<name>.sql) on production (PG_*, read only)
//   OLD@TEST  the same production query on the TEST database
//   NEW@TEST  the new query (superset-queries/NN_<name>.sql) on the TEST database
// and compares
//   1. QUERY CHECK  OLD@TEST vs NEW@TEST  - same data, old vs new query logic
//   2. END TO END   OLD@MAIN vs NEW@TEST  - what the dashboard shows today vs the new dashboard
//   3. DATA CHECK   OLD@MAIN vs OLD@TEST  - is TEST's copy of the data complete?
// Each comparison checks: row count, column names and order, and every cell (rows are paired by
// the component's key columns). Values are compared as the exact text Postgres returns; a cell
// that differs only in formatting (5 vs 5.00, same instant in another notation) is counted apart.
// Every differing row gets a reason when one is known; "UNEXPLAINED" marks the ones to look at.
//
// Both databases are only read (READ ONLY transactions; production also in a read-only session).
// The production LIMIT 1000 is lifted so the full results are compared.
// Output: last-compare-report.txt + compare-out/<component>.csv (every differing cell).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prod, test, closeAll } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const SAMPLES = args.includes('--samples') ? Number(args[args.indexOf('--samples') + 1]) : 5;
const OUT = path.join(__dirname, 'compare-out');

// component → production dataset file, new query file, key columns used to pair rows
const COMPONENTS = [
  ['Campus Phase Progress', 'campus_phase_progress', '01_campus_phase_progress', ['campus_name', 'school_name']],
  ['Campus Phase Timeline & Score', 'campus_phase_timeline_score', '02_campus_phase_timeline_score', ['campus_name', 'school_name', 'phase_name']],
  ['Student Phase Submission Details', 'phase_submission_student_details', '03_student_phase_submission_details', ['email', 'phase_name', 'campus_name', 'school_name']],
  ['Student Missing Phase Submission Details', 'student_missing_phase_submissions', '04_student_missing_phase_submission_details', ['email', 'phase_name', 'campus_name', 'school_name']],
  ['Student Current Phase and Phase Scores', 'student_current_phase_scores', '05_student_current_phase_and_phase_scores', ['email', 'campus_name', 'school_name', 'student_name', 'student_status']],
  ['Concept Explanation Summary View', 'concept_explanation_summary', '06_concept_explanation_summary_view', ['email', 'phase_name']],
  ['Students Concept Explanation Analysis', 'students_concept_explanation_analysis', '07_students_concept_explanation_analysis', ['email', 'phase_name', 'video_title', 'evaluated_at']],
  ['Phasewise Student Project Explanation Analysis', 'phasewise_project_explanation_analysis', '08_phasewise_student_project_explanation_analysis', ['email', 'phase_name', 'criteria', 'evaluated_at']],
  ['Weekly Campus Learning', 'weekly_campus_summary', '09_weekly_campus_learning', ['campus_name', 'week']],
];

const RAW = { getTypeParser: () => (v) => v };          // every value as the exact text Postgres sends
async function run(pool, sql) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN READ ONLY');
    await c.query(`SET LOCAL TIME ZONE 'UTC'`);
    const r = await c.query({ text: sql, types: RAW, rowMode: 'array' });
    await c.query('COMMIT');
    return { cols: r.fields.map((f) => f.name), rows: r.rows };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    return { error: e.message };
  } finally { c.release(); }
}
const sqlOf = (file) => fs.readFileSync(file, 'utf8').split('\n').filter((l) => !l.startsWith('--')).join('\n')
  .trim().replace(/;\s*$/, '').replace(/LIMIT 1000\b/g, 'LIMIT 100000000');

// ---------------------------------------------------------------- comparison ----------
const isNum = (v) => v !== null && /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(String(v).trim());
const sameValue = (a, b) => {
  if (a === null || b === null) return false;
  if (isNum(a) && isNum(b)) return Number(a) === Number(b);
  const da = Date.parse(a), db = Date.parse(b);
  return /\d{4}-\d\d-\d\d/.test(a) && !Number.isNaN(da) && da === db;
};

function compare(A, B, keyCols) {
  const out = { columns: {}, cells: 0, equal: 0, format: 0, value: 0, diffs: [], onlyA: [], onlyB: [], rowsEqual: 0 };
  out.columns.sameOrder = JSON.stringify(A.cols) === JSON.stringify(B.cols);
  out.columns.missing = A.cols.filter((c) => !B.cols.includes(c));
  out.columns.extra = B.cols.filter((c) => !A.cols.includes(c));
  const common = A.cols.filter((c) => B.cols.includes(c));
  const ia = common.map((c) => A.cols.indexOf(c)), ib = common.map((c) => B.cols.indexOf(c));
  const keys = keyCols.filter((k) => common.includes(k));
  const ka = keys.map((k) => A.cols.indexOf(k)), kb = keys.map((k) => B.cols.indexOf(k));
  const group = (rows, ki, ii) => {
    const g = new Map();
    for (const r of rows) {
      const k = JSON.stringify(ki.map((i) => r[i]));
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(ii.map((i) => r[i]));
    }
    for (const list of g.values()) list.sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1));
    return g;
  };
  const ga = group(A.rows, ka, ia), gb = group(B.rows, kb, ib);
  for (const k of new Set([...ga.keys(), ...gb.keys()])) {
    const ra = ga.get(k) || [], rb = gb.get(k) || [];
    const n = Math.min(ra.length, rb.length);
    for (let j = 0; j < n; j++) {
      let rowSame = true;
      for (let c = 0; c < common.length; c++) {
        out.cells++;
        const a = ra[j][c], b = rb[j][c];
        if (a === b) { out.equal++; continue; }
        rowSame = false;
        const kind = sameValue(a, b) ? 'format' : 'value';
        out[kind]++;
        out.diffs.push({ key: JSON.parse(k), column: common[c], a, b, kind, row: Object.fromEntries(common.map((cc, i) => [cc, ra[j][i]])) });
      }
      if (rowSame) out.rowsEqual++;
    }
    for (const r of ra.slice(n)) out.onlyA.push(Object.fromEntries(common.map((c, i) => [c, r[i]])));
    for (const r of rb.slice(n)) out.onlyB.push(Object.fromEntries(common.map((c, i) => [c, r[i]])));
  }
  out.keys = keys;
  out.common = common;
  return out;
}

// ---------------------------------------------------------------- reasons -------------
// Facts about the TEST data that explain known differences between the old and new queries.
async function loadFacts() {
  const facts = {};
  const one = async (pool, sql) => { const r = await run(pool, sql); return r.error ? [] : r.rows.map((x) => x[0]); };
  // YT project videos the OLD query cannot place in a phase (saved under an old phase name)
  facts.oldPhaseName = new Set(await one(test, `
    SELECT DISTINCT lower(trim(e.email)) FROM public.tbl_ailabs_ytfeedback_project_evaluation e
     WHERE NOT EXISTS (SELECT 1 FROM public.tbl_ailabls_ytfeedback_phases p WHERE lower(trim(p.phase_name)) = lower(trim(e.project_name)))`));
  // concept videos the OLD query cannot match to a video title
  facts.unmatchedConcept = new Set(await one(test, `
    SELECT DISTINCT lower(trim(ce.email)) FROM public.tbl_ailabs_ytfeedback_concept_evaluations ce
     WHERE NOT EXISTS (SELECT 1 FROM public.tbl_ailabls_ytfeedback_phasevideos pv JOIN public.tbl_ailabls_ytfeedback_phases p ON p.id = pv.phase_id
                        WHERE lower(trim(ce.page_name)) = lower(trim(pv.video_title))
                           OR lower(trim(ce.page_name)) = lower(trim(pv.video_title || ' - ' || p.phase_name)))`));
  // rows of other institutions (multi-tenant): the OLD query sees them, the NEW one doesn't
  facts.otherInstitution = new Set(await one(test, `
    SELECT DISTINCT lower(trim(x.email)) FROM (
      SELECT email, institution_id FROM public.tbl_ailabs_ytfeedback_project_evaluation
      UNION ALL SELECT email, institution_id FROM public.tbl_ailabs_ytfeedback_concept_evaluations
      UNION ALL SELECT u.email, p.institution_id FROM public.tbl_ailabs_projectanalyzer_projects_af p
                 JOIN public.tbl_ailabs_projectanalyzer_users_af u ON u."_id" = p."userId") x
     WHERE x.institution_id IS DISTINCT FROM (SELECT id FROM public.institutions WHERE slug = 'navgurukul')`));
  // students per campus (to explain aggregated campus rows)
  const r = await run(test, `
    SELECT TRIM(c."Campus_Name"), LOWER(TRIM(s."Navgurukul_Email"))
      FROM public.tbl_ghar_add_student s JOIN public.tbl_ghar_create_campus c ON c."ID"::text = s."Select_Campus"::text
     WHERE s."Navgurukul_Email" IS NOT NULL`);
  facts.campusEmails = new Map();
  for (const [campus, email] of r.rows || []) {
    if (!facts.campusEmails.has(campus)) facts.campusEmails.set(campus, new Set());
    facts.campusEmails.get(campus).add(email);
  }
  // per-email tool rows on each side (for the end-to-end and data checks)
  const COUNTS = `
    SELECT e, sum(yt_p)::int, sum(yt_c)::int, sum(pa)::int FROM (
      SELECT lower(trim(email)) e, 1 yt_p, 0 yt_c, 0 pa FROM public.tbl_ailabs_ytfeedback_project_evaluation
      UNION ALL SELECT lower(trim(email)), 0, 1, 0 FROM public.tbl_ailabs_ytfeedback_concept_evaluations
      UNION ALL SELECT lower(trim(u.email)), 0, 0, 1 FROM public.tbl_ailabs_projectanalyzer_projects_af p
                 JOIN public.tbl_ailabs_projectanalyzer_users_af u ON u."_id" = p."userId") x GROUP BY e`;
  const toMap = (res) => new Map((res.rows || []).map(([e, a, b, c]) => [e, `${a}/${b}/${c}`]));
  facts.countsMain = toMap(await run(prod, COUNTS));
  facts.countsTest = toMap(await run(test, COUNTS));
  return facts;
}

function reasonsFor(row, facts, check) {
  const out = [];
  const emails = [];
  if (row.email) emails.push(String(row.email).toLowerCase().trim());
  else if (row.campus_name && facts.campusEmails.get(row.campus_name)) emails.push(...facts.campusEmails.get(row.campus_name));
  const scope = row.email ? 'student' : 'a student of this campus';
  if (check !== 'data') {
    if (emails.some((e) => facts.oldPhaseName.has(e))) out.push(`${scope} has YT project videos saved under an OLD phase name (old query drops them, new query counts them)`);
    if (emails.some((e) => facts.unmatchedConcept.has(e))) out.push(`${scope} has concept videos whose title the old query cannot match (new query uses the video link)`);
    if (emails.some((e) => facts.otherInstitution.has(e))) out.push(`${scope} has rows of another institution (new query is Navgurukul-only)`);
  }
  if (check !== 'query') {
    const changed = emails.filter((e) => (facts.countsMain.get(e) || '0/0/0') !== (facts.countsTest.get(e) || '0/0/0'));
    if (changed.length) {
      const e = changed[0];
      out.push(`tool data differs between MAIN and TEST for ${row.email ? 'this student' : `${changed.length} student(s) of this campus, e.g. ${e}`} (YT project/concept/PA rows: MAIN ${facts.countsMain.get(e) || '0/0/0'}, TEST ${facts.countsTest.get(e) || '0/0/0'}) - run the daily sync`);
    }
  }
  return out.length ? out : ['UNEXPLAINED'];
}

// ---------------------------------------------------------------- report --------------
const csvCell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

async function main() {
  const lines = [];
  const ro = (await run(prod, `SELECT current_database(), current_setting('transaction_read_only')`)).rows[0];
  if (ro[1] !== 'on') throw new Error('Production session is not read-only; aborting');
  const tdb = (await run(test, `SELECT current_database()`)).rows[0][0];
  const sync = await run(test, `SELECT tool, max(finished_at) FROM migration_sync_runs WHERE ok GROUP BY 1`);
  lines.push(`OLD@MAIN = production queries on ${ro[0]} (read-only)    OLD@TEST / NEW@TEST = on ${tdb} (read-only)`,
    `last successful sync into TEST: ${(sync.rows || []).map((r) => `${r[0]} ${r[1]}`).join(', ') || 'none recorded'}`, '');
  const facts = await loadFacts();
  fs.mkdirSync(OUT, { recursive: true });

  const summary = [];
  for (const [title, prodFile, newFile, keys] of COMPONENTS) {
    const oldSql = sqlOf(path.join(__dirname, 'production-datasets', `${prodFile}.sql`));
    const newSql = sqlOf(path.join(__dirname, 'superset-queries', `${newFile}.sql`));
    const [oM, oT, nT] = [await run(prod, oldSql), await run(test, oldSql), await run(test, newSql)];
    lines.push('='.repeat(100), `${title}   (production: ${prodFile}.sql   new: ${newFile}.sql)`);
    for (const [n, r] of [['OLD@MAIN', oM], ['OLD@TEST', oT], ['NEW@TEST', nT]]) if (r.error) lines.push(`  ${n}: ERROR ${r.error}`);
    lines.push(`  rows: OLD@MAIN ${oM.rows?.length ?? '-'}   OLD@TEST ${oT.rows?.length ?? '-'}   NEW@TEST ${nT.rows?.length ?? '-'}`);
    const csv = [['check', ...keys, 'column', 'old_value', 'new_value', 'difference', 'reason'].map(csvCell).join(',')];
    const sumRow = { title, rows: `${oM.rows?.length ?? '-'} / ${oT.rows?.length ?? '-'} / ${nT.rows?.length ?? '-'}` };

    for (const [check, label, A, B, an, bn] of [
      ['query', 'QUERY CHECK (OLD@TEST vs NEW@TEST, same data)', oT, nT, 'old', 'new'],
      ['e2e', 'END TO END  (OLD@MAIN vs NEW@TEST)', oM, nT, 'old', 'new'],
      ['data', 'DATA CHECK  (OLD@MAIN vs OLD@TEST)', oM, oT, 'main', 'test'],
    ]) {
      if (A.error || B.error) { lines.push(`  ${label}: skipped (query error)`); sumRow[check] = 'error'; continue; }
      const r = compare(A, B, keys);
      const identical = r.columns.sameOrder && !r.value && !r.format && !r.onlyA.length && !r.onlyB.length;
      const colNote = r.columns.sameOrder ? `columns identical (${A.cols.length})`
        : `columns: ${r.columns.missing.length ? `missing in ${bn}: ${r.columns.missing.join(', ')}; ` : ''}${r.columns.extra.length ? `extra in ${bn}: ${r.columns.extra.join(', ')}; ` : ''}${!r.columns.missing.length && !r.columns.extra.length ? 'same names, different order' : ''}`;
      lines.push(`  ${identical ? 'IDENTICAL' : 'DIFFERENT'}  ${label}`);
      lines.push(`      rows ${A.rows.length} vs ${B.rows.length}; ${colNote}; cells compared ${r.cells}: ${r.equal} equal, ${r.value} different value, ${r.format} format only; ` +
        `rows only in ${an}: ${r.onlyA.length}, only in ${bn}: ${r.onlyB.length}; fully equal rows ${r.rowsEqual}`);
      // reasons, per row
      const rowsWithDiff = new Map();
      for (const d of r.diffs) {
        const k = JSON.stringify(d.key);
        if (!rowsWithDiff.has(k)) rowsWithDiff.set(k, { row: d.row, cells: [] });
        rowsWithDiff.get(k).cells.push(d);
      }
      let unexplained = 0;
      const perColumn = {};
      for (const d of r.diffs) perColumn[d.column] = (perColumn[d.column] || 0) + 1;
      if (Object.keys(perColumn).length) lines.push(`      differing cells per column: ${Object.entries(perColumn).map(([c, n]) => `${c}=${n}`).join(', ')}`);
      let shown = 0;
      for (const { row, cells } of rowsWithDiff.values()) {
        const why = reasonsFor(row, facts, check);
        if (why[0] === 'UNEXPLAINED') unexplained++;
        for (const d of cells) csv.push([check, ...keys.map((k) => row[k]), d.column, d.a, d.b, d.kind, why.join(' | ')].map(csvCell).join(','));
        if (shown++ < SAMPLES) {
          lines.push(`      row ${keys.map((k) => `${k}=${row[k]}`).join(', ')}`);
          for (const d of cells.slice(0, 6)) lines.push(`         ${d.column}: ${an}=${JSON.stringify(d.a)}  ${bn}=${JSON.stringify(d.b)}${d.kind === 'format' ? '  (same value, other format)' : ''}`);
          lines.push(`         reason: ${why.join(' | ')}`);
        }
      }
      for (const [side, list, nm] of [['a', r.onlyA, an], ['b', r.onlyB, bn]]) {
        let s = 0;
        for (const row of list) {
          const why = reasonsFor(row, facts, check);
          if (why[0] === 'UNEXPLAINED') unexplained++;
          csv.push([check, ...keys.map((k) => row[k]), '(whole row)', side === 'a' ? JSON.stringify(row) : '', side === 'b' ? JSON.stringify(row) : '', `only in ${nm}`, why.join(' | ')].map(csvCell).join(','));
          if (s++ < SAMPLES) lines.push(`      only in ${nm}: ${keys.map((k) => `${k}=${row[k]}`).join(', ')}  -> ${why.join(' | ')}`);
        }
      }
      if (!identical) lines.push(`      differing rows with no known reason: ${unexplained}${unexplained ? '   <-- look at these (see compare-out CSV)' : ''}`);
      sumRow[check] = identical ? 'identical' : `${r.value + r.format} cells, ${r.onlyA.length + r.onlyB.length} rows differ (${unexplained} unexplained)`;
    }
    fs.writeFileSync(path.join(OUT, `${newFile}.csv`), csv.join('\n') + '\n');
    summary.push(sumRow);
    lines.push('');
  }
  lines.push('='.repeat(100), 'SUMMARY  (rows: OLD@MAIN / OLD@TEST / NEW@TEST)');
  for (const s of summary) {
    lines.push(`  ${s.title}`, `      rows ${s.rows}`, `      query check: ${s.query}`, `      end to end : ${s.e2e}`, `      data check : ${s.data}`);
  }
  lines.push('', `Every differing cell is listed in ${path.relative(process.cwd(), OUT)}/<component>.csv (open in a spreadsheet).`);
  return lines;
}

const t0 = Date.now();
main()
  .then((lines) => {
    const text = lines.join('\n') + `\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`;
    console.log(text);
    fs.writeFileSync(path.join(__dirname, 'last-compare-report.txt'), `${new Date().toISOString()}\n${text}\n`);
  })
  .catch((e) => { console.error('ERROR:', e.message); process.exitCode = 2; })
  .finally(() => closeAll());
