// Brings what happened in MAIN since the last copy into the TEST database (YT tool tables),
// without touching anything created or configured in TEST.
//
//   cd server
//   node scripts/multi-tenant/cutover/sync-from-main.js --dry-run     # what would change
//   node scripts/multi-tenant/cutover/sync-from-main.js               # daily, while testing
//   node scripts/multi-tenant/cutover/sync-from-main.js --final       # at switch time, MAIN frozen
//
// Options
//   --dry-run                  compare only, write nothing
//   --source-wins              every row MAIN has takes MAIN's version, even if edited in TEST
//                              (default: TEST edits are kept; rows changed on both sides are reported)
//   --apply-deletes            rows deleted in MAIN are deleted in TEST too (default: report)
//   --final                    = --source-wins --apply-deletes, and FAILs on anything left to look at
//   --delete-test-only <slug>  delete rows created in TEST for that institution (e.g. testers' evaluations
//                              under navgurukul). Rows of other institutions are never touched.
//   --main-ref <ref>           production branch for the code-drift check (default origin/master)
//   --id-gap <n>               TEST id sequences are kept this far above MAIN's ids (default 1000000)
//
// MAIN (PG_*) is opened read-only. All writes go to TEST_PG_*. Report: last-sync-report.txt.
// Details of every rule: sync-core.cjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { prod, test, closeAll } from '../db.js';
import { LEGACY_TABLES, EVAL_TABLES, TENANT_COLUMNS, backfillTenantLinks } from '../03-copy-from-prod.js';

const require = createRequire(import.meta.url);
const core = require('./sync-core.cjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../../../..');
const TOOL = 'yt';

const args = core.parseArgs(process.argv.slice(2));
const final = Boolean(args.final);
const opts = {
  dryRun: Boolean(args['dry-run']),
  sourceWins: final || Boolean(args['source-wins']),
  applyDeletes: final || Boolean(args['apply-deletes']),
  idGap: args['id-gap'] ? Number(args['id-gap']) : undefined,
  log: (m) => console.log(m),
};
const t0 = Date.now();

async function main() {
  const lines = [];
  let pass = true;
  const ok = (cond, msg) => { lines.push(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) pass = false; };
  const warn = (msg) => { lines.push(`${final ? 'FAIL' : 'WARN'}  ${msg}`); if (final) pass = false; };
  const info = (msg) => lines.push(`INFO  ${msg}`);

  const p = (await prod.query(`SELECT current_database() db, current_setting('transaction_read_only') ro`)).rows[0];
  const t = (await test.query(`SELECT current_database() db`)).rows[0];
  console.log(`MAIN: ${p.db} (read-only=${p.ro})   TEST: ${t.db}${opts.dryRun ? '   [dry run]' : ''}${final ? '   [final]' : ''}`);
  if (p.ro !== 'on') throw new Error('MAIN session is not read-only; aborting');
  ok(true, `MAIN connection is read-only (transaction_read_only=${p.ro})`);

  await core.ensureLedger(test);
  const cut = await core.cutoverOf(test, TOOL);
  if (cut) throw new Error(`The YT tool was switched to this database at ${cut.switched_at.toISOString()}. MAIN is no longer the source; sync refused (see cutover.js).`);

  const ng = (await test.query(
    `SELECT i.id institution_id, p.id program_id FROM institutions i JOIN programs p ON p.institution_id = i.id
      WHERE i.slug = 'navgurukul' AND p.name = 'School of Programming'`)).rows[0];
  if (!ng) throw new Error('Navgurukul not found in TEST (run.js has not been run)');
  const custom = (await test.query(
    `SELECT id FROM prompt_templates WHERE institution_id = $1 AND kind = 'custom' ORDER BY version LIMIT 1`, [ng.institution_id])).rows[0];
  const ids = { institutionId: ng.institution_id, programId: ng.program_id, promptIds: { custom: custom?.id } };
  if (args['delete-test-only']) {
    const inst = (await test.query(`SELECT id FROM institutions WHERE slug = $1`, [args['delete-test-only']])).rows[0];
    if (!inst) throw new Error(`Institution "${args['delete-test-only']}" not found`);
    opts.deleteTestOnlyInstitution = inst.id;
  }
  const run = opts.dryRun ? null : (await test.query(
    `INSERT INTO migration_sync_runs (tool, options) VALUES ($1, $2) RETURNING id`, [TOOL, JSON.stringify({ ...opts, log: undefined })])).rows[0].id;

  // ---- 1. rows -------------------------------------------------------------------------
  console.log('[1/3] Comparing MAIN and TEST …');
  const results = [];
  for (const table of LEGACY_TABLES) {
    const extraColumns = [...TENANT_COLUMNS.all, ...(EVAL_TABLES.includes(table) ? TENANT_COLUMNS.eval : [])];
    results.push(await core.syncPgTable(prod, test, table, { ...opts, extraColumns, excludeColumns: extraColumns.map(([n]) => n) }));
  }
  const present = results.filter((r) => !r.skipped).map((r) => r.table);

  // ---- 2. tenant links for the new rows ------------------------------------------------
  if (!opts.dryRun) {
    console.log('[2/3] Linking new rows to Navgurukul / phase / video / rubric …');
    await backfillTenantLinks(test, ids, present);
    await test.query(fs.readFileSync(path.join(__dirname, '../05-legacy-name-mapping.sql'), 'utf8'));
  }

  // ---- 3. checks -----------------------------------------------------------------------
  console.log('[3/3] Checking …\n');
  const names = Object.fromEntries((await test.query(`SELECT id::text, slug FROM institutions`)).rows.map((r) => [r.id, r.slug]));
  lines.push('', ...core.formatReport(results, names), '');
  for (const r of results) {
    if (r.skipped) continue;
    const c = r.counts;
    if (!opts.dryRun) {
      const k = (await core.tableMeta(prod, r.table)).pk.map((x) => `"${x}"::text`).join(` || '|' || `);
      const mainKeys = (await prod.query(`SELECT ${k} k FROM public."${r.table}"`)).rows.map((x) => x.k);
      const testKeys = new Set((await test.query(`SELECT ${k} k FROM public."${r.table}"`)).rows.map((x) => x.k));
      const missing = mainKeys.filter((x) => !testKeys.has(x)).length;
      ok(missing === c['deleted-in-test'], `${r.table}: every MAIN row is in TEST (${mainKeys.length} rows${missing ? `, ${missing} missing` : ''})`);
      const noInst = Number((await test.query(`SELECT COUNT(*) n FROM public."${r.table}" WHERE institution_id IS NULL`)).rows[0].n);
      ok(noInst === 0, `${r.table}: rows without institution_id = ${noInst}`);
    }
    if (c.conflict) warn(`${r.table}: ${c.conflict} row(s) changed in both MAIN and TEST, TEST kept (ids above; --source-wins takes MAIN's)`);
    if (c['deleted-in-source'] && !opts.applyDeletes) info(`${r.table}: ${c['deleted-in-source']} row(s) deleted in MAIN still in TEST (--apply-deletes)`);
    if (c['deleted-in-source-edited'] && !(opts.applyDeletes && opts.sourceWins)) warn(`${r.table}: ${c['deleted-in-source-edited']} row(s) deleted in MAIN but edited in TEST (kept)`);
    if (r.notes.some((n) => n.includes('NOT resolved'))) warn(`${r.table}: id collision not resolved (see notes)`);
  }
  const unlinked = (await test.query(
    `SELECT COUNT(*)::int n FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE video_assignment_id IS NULL AND institution_id = $1`, [ng.institution_id])).rows[0].n;
  if (unlinked) lines.push(`WARN  ${unlinked} Navgurukul concept evaluation(s) not linked to a video (phase/video name not in the TEST syllabus — was a video added in production?)`);
  else ok(true, 'every Navgurukul concept evaluation is linked to a phase + video');

  // code drift: changes on the production branch the TEST config / this branch does not have
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../navgurukul-seed.json'), 'utf8'));
  const drift = core.codeDrift({ repos: [{ dir: REPO, ref: args['main-ref'] || 'origin/master' }], sources: seed.source_sha256, baseDir: REPO });
  lines.push(...drift.lines.map((l) => (final && l.startsWith('WARN') ? l.replace('WARN', 'FAIL') : l)));
  if (final && drift.drift) pass = false;

  const warnings = lines.filter((l) => l.startsWith('WARN')).length;
  const text = lines.join('\n') + `\n\nRESULT: ${pass ? `ALL CHECKS PASSED${warnings ? ` (${warnings} warning(s) to read)` : ''}` : 'SOME CHECKS FAILED'}${opts.dryRun ? ' (dry run, nothing written)' : ''}  (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`;
  console.log(text);
  fs.writeFileSync(path.join(__dirname, opts.dryRun ? 'last-sync-dry-run.txt' : 'last-sync-report.txt'), `${new Date().toISOString()}  yt sync-from-main ${process.argv.slice(2).join(' ')}\n${text}`);
  if (run) {
    await test.query(`UPDATE migration_sync_runs SET finished_at = NOW(), ok = $2, summary = $3 WHERE id = $1`,
      [run, pass, JSON.stringify(results.map((r) => ({ table: r.table, skipped: r.skipped, counts: r.counts })))]);
  }
  return pass;
}

main()
  .then((pass) => { process.exitCode = pass ? 0 : 1; })
  .catch((e) => { console.error('\nERROR:', e.message); process.exitCode = 2; })
  .finally(() => closeAll());
