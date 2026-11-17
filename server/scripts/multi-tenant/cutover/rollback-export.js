// ROLLBACK helper: writes one SQL file with every YT row created or changed in TEST since the
// cutover, ready to be applied to MAIN after switching the app back. Applies NOTHING itself;
// MAIN is only read (for its column list).
//
//   cd server
//   node scripts/multi-tenant/cutover/rollback-export.js                  # Navgurukul rows only (default)
//   node scripts/multi-tenant/cutover/rollback-export.js --all-institutions
//   node scripts/multi-tenant/cutover/rollback-export.js --since 2026-11-02T04:30:00Z
//
// Then, only if you decide to roll back (after a pg_dump of MAIN):
//   psql "<MAIN connection>" -v ON_ERROR_STOP=1 -1 -f scripts/multi-tenant/cutover/rollback/yt-rollback-<time>.sql
//
// Rows deleted in TEST after the cutover are not removed from MAIN (listed nowhere: the old
// app never deleted evaluations). The file contains student data: keep it out of git.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { prod, test, closeAll } from '../db.js';
import { LEGACY_TABLES } from '../03-copy-from-prod.js';

const require = createRequire(import.meta.url);
const core = require('./sync-core.cjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = core.parseArgs(process.argv.slice(2));

async function main() {
  const cut = await core.cutoverOf(test, 'yt');
  const since = args.since ? new Date(args.since) : cut?.switched_at;
  if (!since || Number.isNaN(since.getTime())) throw new Error('No cutover recorded: pass --since <ISO time>');
  const ng = (await test.query(`SELECT id FROM institutions WHERE slug = 'navgurukul'`)).rows[0].id;
  const { sql, counts } = await core.exportPgRollback(prod, test, {
    tables: LEGACY_TABLES, since, institutionId: args['all-institutions'] ? null : ng,
  });
  const dir = path.join(__dirname, 'rollback');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `yt-rollback-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
  fs.writeFileSync(file, [
    `-- YT tool rollback: rows written to TEST since ${since.toISOString()} → MAIN`,
    `-- generated ${new Date().toISOString()}${args['all-institutions'] ? ' (all institutions)' : ' (Navgurukul only)'}`,
    `-- apply with: psql "<MAIN>" -v ON_ERROR_STOP=1 -1 -f ${path.basename(file)}`, '',
    ...sql].join('\n'));
  for (const [t, n] of Object.entries(counts)) console.log(`  ${t}: ${n}`);
  console.log(`\nWritten: ${path.relative(process.cwd(), file)}  (nothing applied)`);
}

main()
  .catch((e) => { console.error('ERROR:', e.message); process.exitCode = 2; })
  .finally(() => closeAll());
