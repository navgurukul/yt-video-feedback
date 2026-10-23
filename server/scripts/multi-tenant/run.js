// One command to build/refresh the multi-tenant TEST database.
//
//   cd server
//   node scripts/multi-tenant/run.js --super-admin you@navgurukul.org
//   node scripts/multi-tenant/run.js --verify-only
//
// Reads PG_* (production, READ-ONLY session) and TEST_PG_* (writes) from server/.env.
// Writes a report to scripts/multi-tenant/last-run-report.txt.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prod, test, closeAll } from './db.js';
import { seedConfig } from './02-seed-config.js';
import { copyFromProd } from './03-copy-from-prod.js';
import { verify } from './04-verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const verifyOnly = args.includes('--verify-only');
const superAdminEmail = arg('--super-admin') || process.env.SUPER_ADMIN_EMAIL;

const t0 = Date.now();
const log = (m) => console.log(m);

try {
  const p = (await prod.query(`SELECT current_database() db, current_setting('transaction_read_only') ro`)).rows[0];
  const t = (await test.query(`SELECT current_database() db`)).rows[0];
  log(`Production: ${p.db} (read-only=${p.ro})   Test: ${t.db}`);
  if (p.ro !== 'on') throw new Error('Production session is not read-only; aborting.');

  let ids;
  if (!verifyOnly) {
    log('\n[1/4] Creating config schema in TEST ...');
    await test.query(fs.readFileSync(path.join(__dirname, '01-schema.sql'), 'utf8'));

    log('[2/4] Seeding Navgurukul syllabus, rubrics, prompts ...');
    ids = await seedConfig(test, { superAdminEmail });
    if (!superAdminEmail) log('  (no --super-admin given; add one later by re-running with --super-admin)');

    log('[3/4] Copying legacy tables from PRODUCTION (read-only) ...');
    await copyFromProd(prod, test, ids, log);
  } else {
    const r = (await test.query(
      `SELECT i.id institution_id, p.id program_id FROM institutions i JOIN programs p ON p.institution_id = i.id
        WHERE i.slug = 'navgurukul' AND p.name = 'School of Programming'`)).rows[0];
    ids = { institutionId: r.institution_id, programId: r.program_id };
  }

  log('[4/4] Verifying ...\n');
  const { pass, report } = await verify(prod, test, ids);
  const text = report.join('\n') + `\n\nRESULT: ${pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`;
  console.log(text);
  fs.writeFileSync(path.join(__dirname, 'last-run-report.txt'), `${new Date().toISOString()}\n${text}`);
  process.exitCode = pass ? 0 : 1;
} catch (e) {
  console.error('\nERROR:', e.message);
  process.exitCode = 2;
} finally {
  await closeAll();
}
