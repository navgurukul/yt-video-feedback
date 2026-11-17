// Promote the multi-tenant architecture from the TEST database to a target database.
//
//   Rehearsal (recommended first):
//     node scripts/multi-tenant/promote/make-scratch.js          # copy MAIN's legacy tables into SCRATCH_PG_* (MAIN read-only)
//     node scripts/multi-tenant/promote/promote.js --target scratch
//
//   For real (after a pg_dump backup of MAIN):
//     node scripts/multi-tenant/promote/promote.js --target main --i-have-a-backup
//
//   After deploying the new backend, run once more to link rows the old app wrote meanwhile:
//     node scripts/multi-tenant/promote/promote.js --target main --i-have-a-backup --backfill-only
//
// Options:
//   --institutions navgurukul[,other-slug]   which institutions' config to copy from TEST (default: navgurukul)
//   --yes                                    skip the typed confirmation (scratch target only)
//
// What it does (all ADDITIVE; no DROP, RENAME or type change of existing objects):
//   1. creates the config tables (01-schema.sql)
//   2. adds nullable tenant columns to the legacy tables
//   3. copies config from TEST (institutions, programs, phases, rubrics, prompts, videos, memberships),
//      keeping the same UUIDs
//   4. links every legacy row on the target to Navgurukul / phase / video / rubric (only unlinked rows)
//   5. applies 05-legacy-name-mapping.sql, 06-auth.sql, 07-admin.sql
//   6. verifies (no unlinked rows, prompts byte-identical, ...)
// Re-runnable. Undo with promote/down.sql (drops only the NEW tables and columns).
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pkg from 'pg';
import { LEGACY_TABLES, EVAL_TABLES, TENANT_COLUMNS, backfillTenantLinks } from '../03-copy-from-prod.js';
import { verify } from '../04-verify.js';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MT_DIR = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(MT_DIR, '../../.env') });

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const target = opt('--target');
const institutions = opt('--institutions', 'navgurukul').split(',').map((s) => s.trim()).filter(Boolean);
const backfillOnly = flag('--backfill-only');

const env = (k) => (process.env[k] ?? '').trim();
const ssl = (v) => (v === 'true' ? { rejectUnauthorized: false } : false);
const poolFor = (prefix, readOnly = false) => new Pool({
  host: env(`${prefix}HOST`), port: Number(env(`${prefix}PORT`) || 5432), user: env(`${prefix}USER`),
  password: process.env[`${prefix}PASSWORD`], database: env(`${prefix}DATABASE`), ssl: ssl(env(`${prefix}SSL`)),
  max: 3, connectionTimeoutMillis: 20000,
  ...(readOnly ? { options: '-c default_transaction_read_only=on' } : {}),
});

const PREFIX = { main: 'PG_', scratch: 'SCRATCH_PG_' }[target];
if (!PREFIX) { console.error('Usage: promote.js --target scratch|main [--i-have-a-backup] [--backfill-only] [--institutions navgurukul]'); process.exit(1); }
if (target === 'main' && !flag('--i-have-a-backup')) {
  console.error('Refusing to touch MAIN without --i-have-a-backup. Take a pg_dump first (see docs/ROLLOUT.md).');
  process.exit(1);
}
if (!env(`${PREFIX}DATABASE`)) { console.error(`${PREFIX}* is not configured in server/.env`); process.exit(1); }
if (env(`${PREFIX}DATABASE`) === env('TEST_PG_DATABASE') && env(`${PREFIX}HOST`) === env('TEST_PG_HOST')) {
  console.error('Target is the TEST database. Refusing.'); process.exit(1);
}

const dst = poolFor(PREFIX);
const dstRO = poolFor(PREFIX, true);
const src = poolFor('TEST_PG_', true);   // config source, read-only
const log = (m) => console.log(m);
const q = (id) => '"' + id.replace(/"/g, '""') + '"';
const sql = (f) => fs.readFileSync(path.join(MT_DIR, f), 'utf8');

async function confirm() {
  const db = (await dst.query('SELECT current_database() AS d')).rows[0].d;
  if (target === 'scratch' && flag('--yes')) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(`\nAbout to modify database "${db}" (${target}). Type its name to continue: `, r));
  rl.close();
  if (answer.trim() !== db) { console.error('Name did not match. Nothing was changed.'); process.exit(1); }
}

// Copy rows between DBs as JSON (keeps JSON key order), upserting on id.
async function copyTable(table, where, params = []) {
  const { rows } = await src.query(`SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (SELECT * FROM ${q(table)} WHERE ${where}) t`, params);
  const data = rows[0].data;
  if (!data.length) { log(`  - ${table}: 0 rows`); return 0; }
  const cols = (await dst.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [table])).rows.map((r) => r.column_name);
  const list = cols.map(q).join(', ');
  const updates = cols.filter((c) => c !== 'id').map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(', ');
  await dst.query(
    `INSERT INTO ${q(table)} (${list}) SELECT ${list} FROM json_populate_recordset(NULL::${q(table)}, $1::json)
     ON CONFLICT (id) DO UPDATE SET ${updates}`, [JSON.stringify(data)]);
  log(`  - ${table}: ${data.length} rows`);
  return data.length;
}

try {
  const t = (await dst.query(`SELECT current_database() AS d`)).rows[0].d;
  const s = (await src.query(`SELECT current_database() AS d`)).rows[0].d;
  log(`Target: ${t} (${target})   Config source: ${s} (read-only)   Institutions: ${institutions.join(', ')}${backfillOnly ? '   [backfill only]' : ''}`);

  const present = [];
  for (const tb of LEGACY_TABLES) {
    if ((await dst.query(`SELECT to_regclass('public.' || $1) AS r`, [tb])).rows[0].r) present.push(tb);
  }
  for (const tb of present) {
    const n = (await dst.query(`SELECT COUNT(*)::int AS n FROM ${q(tb)}`)).rows[0].n;
    log(`  ${tb}: ${n} rows`);
  }
  await confirm();

  if (!backfillOnly) {
    log('\n[1/6] Config tables …');
    await dst.query(sql('01-schema.sql'));

    log('[2/6] Tenant columns on legacy tables …');
    for (const tb of present) {
      const cols = [...TENANT_COLUMNS.all, ...(EVAL_TABLES.includes(tb) ? TENANT_COLUMNS.eval : [])];
      for (const [name, type] of cols) await dst.query(`ALTER TABLE ${q(tb)} ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    }

    log('[3/6] Copying configuration from TEST …');
    const instIds = (await src.query(`SELECT id FROM institutions WHERE slug = ANY($1)`, [institutions])).rows.map((r) => r.id);
    if (instIds.length !== institutions.length) throw new Error(`Some institutions were not found in TEST: ${institutions.join(', ')}`);
    await copyTable('institutions', 'id = ANY($1)', [instIds]);
    await copyTable('programs', 'institution_id = ANY($1)', [instIds]);
    await copyTable('phases', 'program_id IN (SELECT id FROM programs WHERE institution_id = ANY($1))', [instIds]);
    await copyTable('rubrics', 'institution_id = ANY($1)', [instIds]);
    await copyTable('prompt_templates', 'institution_id = ANY($1) OR institution_id IS NULL', [instIds]);
    await copyTable('video_assignments', 'phase_id IN (SELECT ph.id FROM phases ph JOIN programs p ON p.id = ph.program_id WHERE p.institution_id = ANY($1))', [instIds]);
    await copyTable('user_memberships', "institution_id = ANY($1) OR role = 'super_admin'", [instIds]);
  }

  log(`[4/6] Linking legacy rows (only rows not linked yet) …`);
  const ng = (await dst.query(
    `SELECT i.id AS inst, p.id AS prog FROM institutions i JOIN programs p ON p.institution_id = i.id
      WHERE i.slug = 'navgurukul' AND p.name = 'School of Programming'`)).rows[0];
  if (!ng) throw new Error('Navgurukul / School of Programming not found on the target. Run without --backfill-only first.');
  const custom = (await dst.query(
    `SELECT id FROM prompt_templates WHERE institution_id = $1 AND kind = 'custom' AND is_active ORDER BY version DESC LIMIT 1`, [ng.inst])).rows[0];
  const ids = { institutionId: ng.inst, programId: ng.prog, promptIds: { custom: custom?.id } };
  await backfillTenantLinks(dst, ids, present, log);

  log('[5/6] 05-legacy-name-mapping.sql, 06-auth.sql, 07-admin.sql …');
  for (const f of ['05-legacy-name-mapping.sql', '06-auth.sql', '07-admin.sql']) await dst.query(sql(f));

  log('[6/6] Verifying …\n');
  const { pass, report } = await verify(dstRO, dstRO, ids);
  const text = report.join('\n') + `\n\nRESULT: ${pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}\n`;
  console.log(text);
  fs.writeFileSync(path.join(__dirname, `last-promote-${target}.txt`), `${new Date().toISOString()}\n${text}`);
  process.exitCode = pass ? 0 : 1;
} catch (e) {
  console.error('\nERROR:', e.message);
  process.exitCode = 2;
} finally {
  await Promise.all([dst.end(), dstRO.end(), src.end()]);
}
