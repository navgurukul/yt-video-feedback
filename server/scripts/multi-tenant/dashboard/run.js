// One command for the dashboard on TEST: copy MAIN's dashboard tables + views, rebuild the
// dash views, verify against production.
//
//   cd server
//   node scripts/multi-tenant/dashboard/run.js
//   DASH_READER_PASSWORD='…' node scripts/multi-tenant/dashboard/run.js   # also (re)creates login superset_dash
//
// Run the two daily syncs first so the tool data in TEST is current:
//   yt-video-feedback/server: node scripts/multi-tenant/cutover/sync-from-main.js
//   athena-pa-admin:          node scripts/multi-tenant/cutover/sync-from-main.js
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const step of ['copy-dashboard-tables.js', 'apply-dash-views.js', 'verify-dashboard.js']) {
  console.log(`\n===== ${step} =====`);
  const r = spawnSync(process.execPath, [path.join(__dirname, step), ...process.argv.slice(2)], { stdio: 'inherit' });
  if (r.status) { console.error(`${step} failed (exit ${r.status}); stopping`); process.exit(r.status); }
}
console.log('\nReports: last-copy-report.txt, last-verify-report.txt (in scripts/multi-tenant/dashboard/)');
