// Records (or shows) the moment the YT tool was switched to the TEST database.
//
//   cd server
//   node scripts/multi-tenant/cutover/cutover.js status
//   node scripts/multi-tenant/cutover/cutover.js mark [--note "switched prod env"] [--at 2026-11-02T04:30:00Z]
//   node scripts/multi-tenant/cutover/cutover.js unmark          # only if the switch was called off
//
// After "mark", sync-from-main refuses to run (TEST is now the live database) and
// rollback-export.js exports everything written to TEST after this time.
import { createRequire } from 'module';
import { test, closeAll } from '../db.js';
import { LEGACY_TABLES } from '../03-copy-from-prod.js';

const require = createRequire(import.meta.url);
const core = require('./sync-core.cjs');

core.cutoverCli(test, 'yt', process.argv.slice(2), { tables: LEGACY_TABLES })
  .then((lines) => console.log(lines.join('\n')))
  .catch((e) => { console.error('ERROR:', e.message); process.exitCode = 2; })
  .finally(() => closeAll());
