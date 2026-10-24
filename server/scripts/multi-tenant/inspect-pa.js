// READ-ONLY inventory of the MAIN database tables the Project Analyzer needs:
// Airflow-migrated tables (*_af), project-analyzer tables, and the tables its
// Student Learning Dashboard reads. Also shows which of them already exist in TEST.
//
//   cd server && node scripts/multi-tenant/inspect-pa.js
//
// Writes scripts/multi-tenant/pa-inventory.md. Changes nothing anywhere.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prod, test, closeAll } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = [];
const w = (s = '') => { out.push(s); console.log(s); };

try {
  const ro = (await prod.query(`SELECT current_setting('transaction_read_only') ro, current_database() db`)).rows[0];
  if (ro.ro !== 'on') throw new Error('MAIN session is not read-only; aborting');
  w(`# Project Analyzer: MAIN database inventory (${ro.db}, read-only)\n`);
  w(`Generated ${new Date().toISOString()}\n`);

  const tables = (await prod.query(`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND (table_name LIKE '%\\_af' OR table_name LIKE '%\\_af\\_%' OR table_name ILIKE '%projectanalyzer%'
            OR table_name ILIKE '%athena%' OR table_name LIKE 'tbl\\_ghar\\_%' OR table_name LIKE 'tbl\\_ailabls\\_%'
            OR table_name LIKE 'tbl\\_ailabs\\_phasewise%')
     ORDER BY table_name`)).rows.map((r) => r.table_name);
  const inTest = new Set((await test.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)).rows.map((r) => r.table_name));

  w('## Summary\n');
  w('| Table | Rows | In TEST? |');
  w('|---|---:|---|');
  const counts = {};
  for (const t of tables) {
    counts[t] = Number((await prod.query(`SELECT COUNT(*) c FROM public."${t}"`)).rows[0].c);
    w(`| ${t} | ${counts[t]} | ${inTest.has(t) ? 'yes' : 'no'} |`);
  }

  for (const t of tables) {
    w(`\n## ${t} (${counts[t]} rows)\n`);
    const cols = (await prod.query(`
      SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS nn,
             pg_get_expr(d.adbin, d.adrelid) AS def
        FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = ('public.' || quote_ident($1))::regclass AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`, [t])).rows;
    const pk = (await prod.query(`
      SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = ('public.' || quote_ident($1))::regclass AND i.indisprimary`, [t])).rows.map((r) => r.attname);
    w(`Primary key: ${pk.join(', ') || '(none)'}\n`);
    w('| Column | Type | Not null | Default |');
    w('|---|---|---|---|');
    for (const c of cols) w(`| ${c.name} | ${c.type} | ${c.nn ? 'yes' : ''} | ${c.def ?? ''} |`);

    // Helpful facts for the migration (no row data is printed)
    const names = cols.map((c) => c.name);
    const facts = [];
    const emailCol = ['email', 'user_email', 'student_email'].find((c) => names.includes(c));
    if (emailCol) facts.push(`distinct ${emailCol}: ${(await prod.query(`SELECT COUNT(DISTINCT lower("${emailCol}")) n FROM public."${t}"`)).rows[0].n}`);
    const userCol = ['user_id', 'userid', 'userId'].find((c) => names.includes(c));
    if (userCol) facts.push(`distinct ${userCol}: ${(await prod.query(`SELECT COUNT(DISTINCT "${userCol}") n FROM public."${t}"`)).rows[0].n}`);
    const tsCol = ['created_at', 'createdat', 'createdAt'].find((c) => names.includes(c));
    if (tsCol) {
      const r = (await prod.query(`SELECT MIN("${tsCol}") mn, MAX("${tsCol}") mx FROM public."${t}"`)).rows[0];
      facts.push(`${tsCol}: ${r.mn?.toISOString?.() ?? r.mn} → ${r.mx?.toISOString?.() ?? r.mx}`);
    }
    if (names.includes('phase')) {
      const ph = (await prod.query(`SELECT phase, COUNT(*)::int n FROM public."${t}" GROUP BY 1 ORDER BY 2 DESC LIMIT 12`)).rows;
      facts.push(`phase values: ${ph.map((p) => `${p.phase ?? 'NULL'}=${p.n}`).join(', ')}`);
    }
    if (names.includes('role')) {
      const rl = (await prod.query(`SELECT role, COUNT(*)::int n FROM public."${t}" GROUP BY 1 ORDER BY 2 DESC`)).rows;
      facts.push(`role values: ${rl.map((p) => `${p.role ?? 'NULL'}=${p.n}`).join(', ')}`);
    }
    const mongoCol = ['mongo_id', '_id', 'mongoid', 'mongo_object_id'].find((c) => names.includes(c));
    if (mongoCol) facts.push(`Mongo id column: ${mongoCol}`);
    if (facts.length) w(`\n${facts.map((f) => `- ${f}`).join('\n')}`);
  }

  fs.writeFileSync(path.join(__dirname, 'pa-inventory.md'), out.join('\n') + '\n');
  console.log(`\nSaved to ${path.join(__dirname, 'pa-inventory.md')}`);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await closeAll();
}
