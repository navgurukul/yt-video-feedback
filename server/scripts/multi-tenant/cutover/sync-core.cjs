// Incremental MAIN → TEST sync, shared by both tools' cutover scripts.
// The same file is in:
//   yt-video-feedback/server/scripts/multi-tenant/cutover/sync-core.cjs
//   athena-pa-admin/scripts/multi-tenant/cutover/sync-core.cjs
//
// How a row is handled
// --------------------
// A ledger in TEST (migration_sync_ledger) remembers, for every row the sync wrote or
// confirmed, a hash of the source row and a hash of the TEST row at that moment. On the
// next run each row is compared three ways (source now / TEST now / ledger):
//
//   source only                       → insert into TEST
//   source changed, TEST unchanged    → update TEST
//   TEST changed, source unchanged    → keep TEST (counted as "edited in TEST")
//   both changed                      → conflict: keep TEST, report
//   (--source-wins: MAIN's version wins for every row MAIN has — TEST edits and conflicts are
//    overwritten. Use it for the final sync: until the switch, edits in TEST are only tests.)
//   same id but a different row       → id collision (a row created in TEST took an id that
//     (created_at differs)               MAIN later used): the TEST row is moved to a new id,
//                                        the MAIN row is inserted with its own id
//   gone from source                  → report  (--apply-deletes: delete from TEST)
//   only in TEST, never synced        → row created in TEST: always kept (--delete-test-only
//                                        <institution-slug> removes them for that institution)
//
// Rows that have no ledger entry yet (the first run after the initial copy) are matched by
// content; if they differ, the source wins unless the TEST row is newer (then: conflict).
//
// MAIN is only read, through a read-only session. Nothing here writes outside TEST.
"use strict";
const crypto = require("crypto");

const q = (id) => '"' + String(id).replace(/"/g, '""') + '"';
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const BATCH = 200;

const LEDGER_SQL = `
CREATE TABLE IF NOT EXISTS migration_sync_ledger (
  table_name  TEXT NOT NULL,
  row_key     TEXT NOT NULL,
  src_hash    TEXT NOT NULL,
  dst_hash    TEXT NOT NULL,
  src_ts      TEXT,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_name, row_key)
);
CREATE TABLE IF NOT EXISTS migration_sync_runs (
  id           BIGSERIAL PRIMARY KEY,
  tool         TEXT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  options      JSONB,
  summary      JSONB,
  ok           BOOLEAN
);
CREATE TABLE IF NOT EXISTS migration_cutover (
  tool         TEXT PRIMARY KEY,
  switched_at  TIMESTAMPTZ NOT NULL,
  note         TEXT
);`;

async function ensureLedger(test) {
  await test.query(LEDGER_SQL);
}

async function loadLedger(db, table) {
  const { rows } = await db.query(
    `SELECT row_key, src_hash, dst_hash, src_ts FROM migration_sync_ledger WHERE table_name = $1`, [table]);
  return new Map(rows.map((r) => [r.row_key, r]));
}

async function saveLedger(db, table, entries) {
  for (let i = 0; i < entries.length; i += 1000) {
    const part = entries.slice(i, i + 1000);
    await db.query(
      `INSERT INTO migration_sync_ledger (table_name, row_key, src_hash, dst_hash, src_ts)
       SELECT $1, k, s, d, t FROM unnest($2::text[], $3::text[], $4::text[], $5::text[]) AS x(k, s, d, t)
       ON CONFLICT (table_name, row_key) DO UPDATE
         SET src_hash = EXCLUDED.src_hash, dst_hash = EXCLUDED.dst_hash, src_ts = EXCLUDED.src_ts, synced_at = NOW()`,
      [table, part.map((e) => e.key), part.map((e) => e.src_hash), part.map((e) => e.dst_hash), part.map((e) => e.src_ts ?? null)]);
  }
}

async function dropLedger(db, table, keys) {
  if (keys.length) await db.query(`DELETE FROM migration_sync_ledger WHERE table_name = $1 AND row_key = ANY($2::text[])`, [table, keys]);
}

/**
 * src / dst: { hash, ts, ident } or undefined.  led: ledger entry or undefined.
 * same(): content equal (only asked when there is no ledger entry).
 */
function decide({ src, dst, led, same, sourceWins }) {
  if (src && !dst) return led ? (sourceWins ? "insert" : "deleted-in-test") : "insert";
  if (src && dst) {
    if (led) {
      const srcChanged = src.hash !== led.src_hash;
      const dstChanged = dst.hash !== led.dst_hash;
      if (!srcChanged) return dstChanged ? (sourceWins ? "update" : "test-edit") : "same";
      if (!dstChanged) return "update";
      return sourceWins ? "update" : "conflict";
    }
    if (src.ident != null && dst.ident != null && src.ident !== dst.ident) return "collision";
    if (same()) return "same";
    if (src.ts && dst.ts && Date.parse(dst.ts) > Date.parse(src.ts)) return sourceWins ? "update" : "conflict";
    return "update";
  }
  if (!src && dst) {
    if (!led) return "test-only";
    return dst.hash === led.dst_hash ? "deleted-in-source" : "deleted-in-source-edited";
  }
  return led ? "ledger-orphan" : "none";
}

function newCounts() {
  return {
    inserted: 0, updated: 0, same: 0, "test-edit": 0, conflict: 0, collision: 0,
    "deleted-in-source": 0, "deleted-in-source-edited": 0, "deleted-in-test": 0, "test-only": 0,
    deleted: 0, "test-only-deleted": 0, "ledger-orphan": 0, insert: 0, update: 0,
  };
}

// ---------------------------------------------------------------------------------------
// Postgres → Postgres (YT tables, dashboard / reference tables)
// ---------------------------------------------------------------------------------------

async function tableMeta(db, table) {
  const exists = (await db.query(`SELECT to_regclass('public.' || quote_ident($1)) AS t`, [table])).rows[0].t;
  if (!exists) return null;
  const cols = (await db.query(
    `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null,
            pg_get_expr(d.adbin, d.adrelid) AS def, a.attidentity AS identity
       FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = ('public.' || quote_ident($1))::regclass AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`, [table])).rows;
  const pk = (await db.query(
    `SELECT a.attname FROM pg_index i
       JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, n) ON TRUE
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
      WHERE i.indrelid = ('public.' || quote_ident($1))::regclass AND i.indisprimary ORDER BY k.n`, [table])).rows.map((r) => r.attname);
  return { cols, pk };
}

function columnDDL(c, { plain = false } = {}) {
  const isSeq = c.identity || (c.def && c.def.startsWith("nextval("));
  let s = `${q(c.name)} ${c.type}`;
  if (isSeq && !plain) s += " GENERATED BY DEFAULT AS IDENTITY";
  else if (c.def && !isSeq) s += ` DEFAULT ${c.def}`;
  if (c.not_null && !plain) s += " NOT NULL";
  return s;
}

/** Creates the table in TEST if MAIN has it and TEST does not; adds columns MAIN gained. */
async function ensureTestTable(test, table, srcMeta, extraColumns = []) {
  const inTest = (await test.query(`SELECT to_regclass('public.' || quote_ident($1)) AS t`, [table])).rows[0].t;
  let created = false;
  if (!inTest) {
    const parts = srcMeta.cols.map((c) => columnDDL(c));
    if (srcMeta.pk.length) parts.push(`PRIMARY KEY (${srcMeta.pk.map(q).join(", ")})`);
    await test.query(`CREATE TABLE ${q(table)} (\n  ${parts.join(",\n  ")}\n)`);
    created = true;
  }
  const have = new Set((await test.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table])).rows.map((r) => r.column_name));
  const added = [];
  for (const c of srcMeta.cols) {
    if (!have.has(c.name)) {
      await test.query(`ALTER TABLE ${q(table)} ADD COLUMN IF NOT EXISTS ${columnDDL(c, { plain: true })}`);
      added.push(c.name);
    }
  }
  for (const [name, type] of extraColumns) await test.query(`ALTER TABLE ${q(table)} ADD COLUMN IF NOT EXISTS ${q(name)} ${type}`);
  return { created, added };
}

async function withUtc(pool, fn) {
  const c = await pool.connect();
  try {
    await c.query(`SET TIME ZONE 'UTC'`);
    return await fn(c);
  } finally {
    c.release();
  }
}

async function sequenceOf(db, table, col = "id") {
  return (await db.query(`SELECT pg_get_serial_sequence(quote_ident($1), $2) AS s`, [table, col])).rows[0].s;
}

/** FK columns in other tables that point at table(id). */
async function referencingColumns(db, table) {
  return (await db.query(
    `SELECT c.conrelid::regclass::text AS child, a.attname AS col
       FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.confrelid = ('public.' || quote_ident($1))::regclass AND array_length(c.conkey, 1) = 1`,
    [table])).rows;
}

/** Moves a row created in TEST to a fresh id (children that reference it follow). */
async function moveTestRow(client, table, oldId, seq) {
  const cols = (await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table])).rows.map((r) => r.column_name);
  const newId = (await client.query(`SELECT nextval($1::regclass)::text AS id`, [seq])).rows[0].id;
  const list = cols.map(q).join(", ");
  const select = cols.map((c) => (c === "id" ? `$2::bigint` : q(c))).join(", ");
  await client.query(`INSERT INTO ${q(table)} (${list}) OVERRIDING SYSTEM VALUE SELECT ${select} FROM ${q(table)} WHERE id::text = $1`, [String(oldId), newId]);
  for (const r of await referencingColumns(client, table)) {
    await client.query(`UPDATE ${r.child} SET ${q(r.col)} = $2 WHERE ${q(r.col)}::text = $1`, [String(oldId), newId]);
  }
  await client.query(`DELETE FROM ${q(table)} WHERE id::text = $1`, [String(oldId)]);
  return newId;
}

/**
 * Syncs one table MAIN → TEST.
 * opts: { dryRun, sourceWins, applyDeletes, deleteTestOnlyInstitution, idGap, headroom, identity,
 *         mirror (reference tables: TEST becomes an exact copy of MAIN, rows only in TEST are removed),
 *         extraColumns, excludeColumns, log }
 */
async function syncPgTable(main, test, table, opts = {}) {
  const log = opts.log || (() => {});
  const r = { table, counts: newCounts(), samples: {}, notes: [] };
  const sample = (kind, key) => { (r.samples[kind] ||= []).length < 15 && r.samples[kind].push(key); };

  const srcMeta = await tableMeta(main, table);
  if (!srcMeta) { r.skipped = "not in MAIN"; return r; }
  if (!srcMeta.pk.length) { r.skipped = "no primary key in MAIN (not synced)"; return r; }
  { // tenant columns belong to TEST only, even if MAIN has columns of the same name
    const exclude = new Set(opts.excludeColumns || []);
    srcMeta.cols = srcMeta.cols.filter((c) => !exclude.has(c.name) || srcMeta.pk.includes(c.name));
  }
  if (!opts.dryRun) {
    const { created, added } = await ensureTestTable(test, table, srcMeta, opts.extraColumns || []);
    if (created) r.notes.push("table created in TEST (new in MAIN)");
    if (added.length) r.notes.push(`columns added in TEST: ${added.join(", ")}`);
  } else if (!(await tableMeta(test, table))) {
    r.notes.push("table missing in TEST (would be created)");
  }

  const cols = srcMeta.cols.map((c) => c.name);
  const colList = cols.map(q).join(", ");
  const pk = srcMeta.pk;
  const keyExpr = (alias) => (pk.length === 1 ? `${alias}.${q(pk[0])}::text` : `concat_ws('|', ${pk.map((c) => `${alias}.${q(c)}::text`).join(", ")})`);
  const tsCol = ["updated_at", "updatedAt", "created_at", "createdAt"].find((c) => cols.includes(c));
  const identCol = opts.identity === false ? null : ["created_at", "createdAt"].find((c) => cols.includes(c));
  const testCols = new Set((await test.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table])).rows.map((x) => x.column_name));
  const hasInst = testCols.has("institution_id");
  if (opts.dryRun && testCols.size && cols.some((c) => !testCols.has(c))) {
    r.skipped = `TEST lacks columns ${cols.filter((c) => !testCols.has(c)).join(", ")} (a real run adds them)`;
    return r;
  }

  const indexSql = (withInst) => `
    SELECT ${keyExpr("t")} AS k, md5((to_jsonb(t) - '__inst')::text) AS h,
           ${tsCol ? `t.${q(tsCol)}::text` : "NULL"} AS ts, ${identCol ? `t.${q(identCol)}::text` : "NULL"} AS ident,
           ${withInst ? "t.__inst::text" : "NULL"} AS inst
      FROM (SELECT ${colList}${withInst ? ", institution_id AS __inst" : ""} FROM public.${q(table)}) t`;

  // ---- id headroom: rows created in TEST get ids MAIN will not reach ------------------
  const seq = pk.length === 1 && pk[0] === "id" && testCols.has("id") ? await sequenceOf(test, table) : null;
  if (seq && !opts.dryRun && opts.headroom !== false) {
    const mainMax = Number((await main.query(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM public.${q(table)}`)).rows[0].m);
    const cur = (await test.query(`SELECT last_value::bigint AS v, is_called FROM ${seq}`)).rows[0];
    const gap = opts.idGap ?? 1000000;
    if (Number(cur.v) < mainMax + gap / 2) {
      await test.query(`SELECT setval($1::regclass, $2)`, [seq, mainMax + gap]);
      r.notes.push(`TEST id sequence moved to ${mainMax + gap} (new TEST rows will not collide with MAIN ids)`);
    }
  }

  const [srcRows, dstRows, ledger] = await Promise.all([
    withUtc(main, (c) => c.query(indexSql(false))).then((x) => x.rows),
    testCols.size ? withUtc(test, (c) => c.query(indexSql(hasInst))).then((x) => x.rows) : [],
    loadLedger(test, table),
  ]);
  const src = new Map(srcRows.map((x) => [x.k, x]));
  const dst = new Map(dstRows.map((x) => [x.k, x]));
  const keys = new Set([...src.keys(), ...dst.keys(), ...ledger.keys()]);

  const plan = { insert: [], update: [], collision: [], deleteSrcGone: [], deleteTestOnly: [], ledgerSame: [], ledgerDrop: [] };
  const testOnlyByInst = {};
  for (const k of keys) {
    const s = src.get(k), d = dst.get(k), led = ledger.get(k);
    const view = (x) => x && { hash: x.h, ts: x.ts, ident: x.ident };
    const decision = decide({ src: view(s), dst: view(d), led, same: () => s.h === d.h, sourceWins: opts.sourceWins });
    switch (decision) {
      case "insert": plan.insert.push(k); break;
      case "update": plan.update.push(k); break;
      case "same": r.counts.same++; if (!led || led.dst_hash !== d.h) plan.ledgerSame.push({ key: k, src_hash: s.h, dst_hash: d.h, src_ts: s.ts }); break;
      case "collision": plan.collision.push(k); break;
      case "deleted-in-source":
        r.counts[decision]++; sample(decision, k);
        if (opts.applyDeletes) plan.deleteSrcGone.push(k);
        break;
      case "test-only":
        r.counts[decision]++; sample(decision, k);
        testOnlyByInst[d.inst || "none"] = (testOnlyByInst[d.inst || "none"] || 0) + 1;
        if (opts.mirror || (opts.deleteTestOnlyInstitution && d.inst === opts.deleteTestOnlyInstitution)) plan.deleteTestOnly.push(k);
        break;
      case "deleted-in-source-edited":
        r.counts[decision]++; sample(decision, k);
        if (opts.applyDeletes && opts.sourceWins) plan.deleteSrcGone.push(k);
        break;
      case "ledger-orphan": plan.ledgerDrop.push(k); break;
      default: r.counts[decision]++; sample(decision, k);
    }
  }
  r.testOnlyByInstitution = testOnlyByInst;
  if (seq === null && plan.collision.length) {
    // no integer sequence to move TEST rows to: report only
    for (const k of plan.collision) { r.counts.collision++; sample("collision-unresolved", k); }
    plan.collision = [];
  }
  r.counts.collision += plan.collision.length;
  for (const k of plan.collision) sample("collision", k);
  for (const k of plan.update.slice(0, 15)) sample("updated", k);
  for (const k of plan.insert.slice(0, 15)) sample("inserted", k);

  if (opts.dryRun) {
    r.counts.inserted = plan.insert.length + plan.collision.length;
    r.counts.updated = plan.update.length;
    r.counts.deleted = plan.deleteSrcGone.length;
    r.counts["test-only-deleted"] = plan.deleteTestOnly.length;
    r.dryRun = true;
    return r;
  }

  // ---- writes (TEST only), one transaction per batch, ledger in the same transaction ---
  const upsertFromMain = async (client, batch, mode) => {
    const data = (await withUtc(main, (c) => c.query(
      `SELECT COALESCE(json_agg(t), '[]'::json)::text AS data FROM (SELECT ${colList} FROM public.${q(table)} t WHERE ${keyExpr("t")} = ANY($1::text[])) t`,
      [batch]))).rows[0].data;
    if (data === "[]") return; // JSON kept as text: Node would round 18-digit numbers
    if (mode === "insert") {
      await client.query(
        `INSERT INTO ${q(table)} (${colList}) OVERRIDING SYSTEM VALUE
         SELECT ${colList} FROM json_populate_recordset(NULL::${q(table)}, $1::json)`, [data]);
    } else {
      const set = cols.filter((c) => !pk.includes(c)).map((c) => `${q(c)} = s.${q(c)}`).join(", ");
      const on = pk.map((c) => `t.${q(c)} = s.${q(c)}`).join(" AND ");
      if (set) await client.query(`UPDATE ${q(table)} t SET ${set} FROM json_populate_recordset(NULL::${q(table)}, $1::json) s WHERE ${on}`, [data]);
    }
  };
  const recordWritten = async (client, batch) => {
    // (the transaction runs with TIME ZONE UTC, like the index queries)
    const fresh = (await client.query(`${indexSql(false)} WHERE ${keyExpr("t")} = ANY($1::text[])`, [batch])).rows;
    await saveLedger(client, table, fresh.map((x) => ({ key: x.k, src_hash: src.get(x.k).h, dst_hash: x.h, src_ts: src.get(x.k).ts })));
  };
  const inTx = async (fn) => {
    const c = await test.connect();
    try {
      await c.query("BEGIN");
      await c.query(`SET LOCAL TIME ZONE 'UTC'`);
      const out = await fn(c);
      await c.query("COMMIT");
      return out;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  };

  // collisions: move the TEST row away first, then the MAIN row is a plain insert
  for (const k of plan.collision) {
    try {
      const newId = await inTx((c) => moveTestRow(c, table, k, seq));
      r.notes.push(`id ${k}: row created in TEST moved to id ${newId}; MAIN row inserted with id ${k}`);
      plan.insert.push(k);
    } catch (e) {
      r.notes.push(`id ${k}: collision NOT resolved (${e.message})`);
    }
  }
  for (let i = 0; i < plan.insert.length; i += BATCH) {
    const batch = plan.insert.slice(i, i + BATCH);
    await inTx(async (c) => { await upsertFromMain(c, batch, "insert"); await recordWritten(c, batch); });
    r.counts.inserted += batch.length;
  }
  for (let i = 0; i < plan.update.length; i += BATCH) {
    const batch = plan.update.slice(i, i + BATCH);
    await inTx(async (c) => { await upsertFromMain(c, batch, "update"); await recordWritten(c, batch); });
    r.counts.updated += batch.length;
  }
  if (plan.ledgerSame.length) await saveLedger(test, table, plan.ledgerSame);
  const del = async (list, counter) => {
    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH);
      await inTx(async (c) => {
        await c.query(`DELETE FROM ${q(table)} t WHERE ${keyExpr("t")} = ANY($1::text[])`, [batch]);
        await dropLedger(c, table, batch);
      });
      r.counts[counter] += batch.length;
    }
  };
  await del(plan.deleteSrcGone, "deleted");
  await del(plan.deleteTestOnly, "test-only-deleted");
  await dropLedger(test, table, plan.ledgerDrop);

  // keep the sequence above every id now in TEST
  if (seq) {
    await test.query(`SELECT setval($1::regclass, GREATEST((SELECT last_value FROM ${seq}), (SELECT COALESCE(MAX(id), 1) FROM ${q(table)})))`, [seq]);
  }
  log(`  - ${table}: ${summaryLine(r)}`);
  return r;
}

function summaryLine(r) {
  if (r.skipped) return `skipped (${r.skipped})`;
  const c = r.counts;
  const parts = [`+${c.inserted} new`, `~${c.updated} updated`, `${c.same} unchanged`];
  if (c["test-edit"]) parts.push(`${c["test-edit"]} edited in TEST (kept)`);
  if (c.conflict) parts.push(`${c.conflict} CONFLICT(S) (kept TEST)`);
  if (c.collision) parts.push(`${c.collision} id collision(s)`);
  if (c["deleted-in-source"]) parts.push(`${c["deleted-in-source"]} deleted in MAIN${c.deleted ? ` (${c.deleted} deleted in TEST)` : " (kept; --apply-deletes)"}`);
  if (c["deleted-in-source-edited"]) parts.push(`${c["deleted-in-source-edited"]} deleted in MAIN but edited in TEST (kept)`);
  if (c["deleted-in-test"]) parts.push(`${c["deleted-in-test"]} deleted in TEST (not re-added)`);
  if (c["test-only"]) parts.push(`${c["test-only"]} created in TEST${c["test-only-deleted"] ? ` (${c["test-only-deleted"]} removed)` : ""}`);
  return parts.join(", ") + (r.dryRun ? "  [dry run]" : "");
}

/** Text report for all tables, with samples of ids worth a look. */
function formatReport(results, institutionNames = {}) {
  const out = [];
  for (const r of results) {
    out.push(`${r.table}: ${summaryLine(r)}`);
    for (const n of r.notes || []) out.push(`    note: ${n}`);
    if (r.testOnlyByInstitution && Object.keys(r.testOnlyByInstitution).length) {
      out.push(`    created in TEST, by institution: ${Object.entries(r.testOnlyByInstitution).map(([k, v]) => `${institutionNames[k] || k}=${v}`).join(", ")}`);
    }
    for (const [kind, ids] of Object.entries(r.samples || {})) {
      if (["inserted", "updated"].includes(kind)) continue;
      out.push(`    ${kind}: ${ids.join(", ")}${ids.length >= 15 ? ", …" : ""}`);
    }
  }
  return out;
}

async function cutoverOf(test, tool) {
  const has = (await test.query(`SELECT to_regclass('public.migration_cutover') t`)).rows[0].t;
  if (!has) return null;
  return (await test.query(`SELECT switched_at, note FROM migration_cutover WHERE tool = $1`, [tool])).rows[0] || null;
}

/**
 * Has the production branch moved on since the multi-tenant branch was cut?
 *   repos:   [{ dir, ref }]  (ref e.g. "origin/master"; run `git fetch` first for an up-to-date answer)
 *   sources: { "<path relative to baseDir>": sha256 } from the seed snapshot (config copied into the DB)
 * Returns report lines: WARN for seed sources changed on the production branch, INFO for commits
 * on the production branch that the multi-tenant branch does not have.
 */
function codeDrift({ repos, sources = {}, baseDir }) {
  const { execFileSync } = require("child_process");
  const path = require("path");
  const git = (dir, args) => execFileSync("git", ["-C", dir, ...args], { encoding: "buffer", stdio: ["ignore", "pipe", "ignore"] });
  const lines = [];
  let drift = false;
  for (const { dir, ref } of repos) {
    const name = path.basename(dir);
    let missing;
    try { missing = git(dir, ["rev-list", "--count", `HEAD..${ref}`]).toString().trim(); } catch {
      lines.push(`WARN  ${name}: cannot read ${ref} (git fetch, or pass --main-ref)`); drift = true; continue;
    }
    if (missing !== "0") {
      drift = true;
      const log = git(dir, ["log", "--format=%h %ad %s", "--date=short", "-10", `HEAD..${ref}`]).toString().trim().split("\n");
      lines.push(`WARN  ${name}: ${missing} commit(s) on ${ref} are not in this branch — merge them into the multi-tenant branch before switching:`);
      for (const l of log) lines.push(`        ${l}`);
    } else lines.push(`PASS  ${name}: no commits on ${ref} missing from this branch`);
    for (const [rel, sha] of Object.entries(sources)) {
      const abs = path.resolve(baseDir, rel);
      const relToRepo = path.relative(dir, abs);
      if (relToRepo.startsWith("..")) continue;
      let now;
      try { now = crypto.createHash("sha256").update(git(dir, ["show", `${ref}:${relToRepo.split(path.sep).join("/")}`])).digest("hex"); } catch {
        lines.push(`WARN  ${rel} not found on ${ref}: cannot check it`); drift = true; continue;
      }
      if (now !== sha) {
        drift = true;
        lines.push(`WARN  ${rel} changed on ${ref} since the DB config was seeded — the TEST config (phases/rubrics/prompts) must be updated to match`);
      } else lines.push(`PASS  ${rel} on ${ref} = seeded config`);
    }
  }
  return { drift, lines };
}

// ---------------------------------------------------------------------------------------
// Cutover marker: from this moment the tool writes to TEST, and MAIN is no longer the source.
// ---------------------------------------------------------------------------------------
async function cutoverCli(test, tool, argv, { tables = [] } = {}) {
  const a = parseArgs(argv);
  const cmd = argv.find((x) => !x.startsWith("--")) || "status";
  await ensureLedger(test);
  const out = [];
  if (cmd === "mark") {
    const at = a.at ? new Date(a.at) : new Date();
    if (Number.isNaN(at.getTime())) throw new Error(`--at "${a.at}" is not a date`);
    await test.query(
      `INSERT INTO migration_cutover (tool, switched_at, note) VALUES ($1, $2, $3)
       ON CONFLICT (tool) DO UPDATE SET switched_at = EXCLUDED.switched_at, note = EXCLUDED.note`,
      [tool, at, a.note || null]);
    out.push(`${tool}: cutover marked at ${at.toISOString()} — sync-from-main is now refused; rollback-export uses this time.`);
  } else if (cmd === "unmark") {
    await test.query(`DELETE FROM migration_cutover WHERE tool = $1`, [tool]);
    out.push(`${tool}: cutover mark removed (sync-from-main allowed again).`);
  } else if (cmd !== "status") {
    throw new Error(`Unknown command "${cmd}". Use: status | mark [--at <ISO time>] [--note "..."] | unmark`);
  }
  const cut = await cutoverOf(test, tool);
  out.push(`${tool}: ${cut ? `SWITCHED to this database at ${cut.switched_at.toISOString()}${cut.note ? ` (${cut.note})` : ""}` : "not switched yet (MAIN is the source; run sync-from-main)"}`);
  const runs = (await test.query(
    `SELECT id, started_at, finished_at, ok, options->>'dryRun' dry, options->>'sourceWins' sw, options->>'applyDeletes' ad
       FROM migration_sync_runs WHERE tool = $1 ORDER BY id DESC LIMIT 5`, [tool])).rows;
  out.push("last syncs:");
  for (const r of runs) {
    out.push(`  #${r.id} ${r.started_at.toISOString()}  ${r.finished_at ? (r.ok ? "ok" : "FAILED checks") : "did not finish"}${r.sw === "true" ? "  source-wins" : ""}${r.ad === "true" ? "  apply-deletes" : ""}`);
  }
  if (!runs.length) out.push("  none");
  if (tables.length) {
    const led = (await test.query(
      `SELECT table_name, COUNT(*)::int n, MAX(synced_at) last FROM migration_sync_ledger WHERE table_name = ANY($1) GROUP BY 1 ORDER BY 1`, [tables])).rows;
    out.push("rows tracked by the sync:");
    for (const r of led) out.push(`  ${r.table_name}: ${r.n} (last written/confirmed ${r.last.toISOString()})`);
  }
  return out;
}

/**
 * For a rollback to the old app on MAIN: every row created or changed in TEST since the cutover,
 * as one SQL file that upserts into MAIN (MAIN's own columns only). Nothing is applied here.
 */
async function exportPgRollback(main, test, { tables, since, institutionId }) {
  const sql = [];
  const counts = {};
  for (const table of tables) {
    const mainMeta = await tableMeta(main, table);
    const testMeta = await tableMeta(test, table);
    if (!mainMeta || !testMeta) { counts[table] = "skipped (missing)"; continue; }
    const testCols = new Set(testMeta.cols.map((c) => c.name));
    const cols = mainMeta.cols.map((c) => c.name).filter((c) => testCols.has(c));
    const tsCols = ["created_at", "updated_at", "createdAt", "updatedAt"].filter((c) => testCols.has(c));
    if (!tsCols.length) { counts[table] = "skipped (no timestamp column)"; continue; }
    const changed = `GREATEST(${tsCols.map((c) => `${q(c)}::timestamptz`).join(", ")}) > $1`;
    const instFilter = institutionId && testCols.has("institution_id") ? ` AND institution_id = $2` : "";
    const data = (await withUtc(test, (c) => c.query(
      `SELECT COALESCE(json_agg(t ORDER BY ${mainMeta.pk.map(q).join(", ")}), '[]'::json)::text AS data, count(*)::int AS n
         FROM (SELECT ${cols.map(q).join(", ")} FROM ${q(table)} WHERE ${changed}${instFilter}) t`,
      institutionId && instFilter ? [since, institutionId] : [since]))).rows[0];
    const n = data.n; // JSON kept as text: Node would round 18-digit numbers
    counts[table] = n;
    if (!n) continue;
    const json = data.data;
    let tag = "rb";
    while (json.includes(`$${tag}$`)) tag += "x";
    const update = cols.filter((c) => !mainMeta.pk.includes(c)).map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(", ");
    sql.push(`-- ${table}: ${n} row(s) created or changed in TEST since ${since.toISOString()}`,
      `INSERT INTO ${q(table)} (${cols.map(q).join(", ")}) OVERRIDING SYSTEM VALUE`,
      `SELECT ${cols.map(q).join(", ")} FROM json_populate_recordset(NULL::${q(table)}, $${tag}$${json}$${tag}$)`,
      `ON CONFLICT (${mainMeta.pk.map(q).join(", ")}) DO ${update ? `UPDATE SET ${update}` : "NOTHING"};`, "");
  }
  return { sql, counts };
}

/** Simple argv parser: --flag, --key value, --key=value */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=", 2);
    if (v !== undefined) out[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

module.exports = {
  q, md5, BATCH, ensureLedger, loadLedger, saveLedger, dropLedger, decide, newCounts,
  tableMeta, ensureTestTable, withUtc, syncPgTable, summaryLine, formatReport, cutoverOf, parseArgs, codeDrift,
  cutoverCli, exportPgRollback,
};
