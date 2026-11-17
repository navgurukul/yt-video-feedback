# Prompt 8: switching both tools to the TEST database (and back)

The plan: **production data is never migrated into MAIN.** Everything is prepared in
`test_ghar_central_db`. On switch day both tools are pointed at that database. If anything goes
wrong, they are pointed back at MAIN / MongoDB with the old code.

```
 today ─────────── testing (a few days) ─────────── switch day ─────────── live on TEST
   │  daily: sync-from-main (production → TEST)        │ freeze → final sync →     │ rollback possible:
   │  MAIN + MongoDB only read                         │ mark → env switch         │ rollback-export → old env
```

This file is the same in both repos:

- `yt-video-feedback/server/scripts/multi-tenant/cutover/`
- `athena-pa-admin/scripts/multi-tenant/cutover/`

Both copies of `sync-core.cjs` are identical too.

## What the sync does

| Tool | Source (read only) | Into TEST |
|---|---|---|
| YT | MAIN `PG_*`: `tbl_ailabs_ytfeedback_*`, `tbl_manual_video_evaluations`, `tbl_llm_api_calls`, `tbl_user_issues`, `tbl_failed_requests` | the same tables, then linked to Navgurukul / phase / video / rubric, with memberships for new users |
| PA | production **MongoDB** (`MONGO_URI`): all 11 collections. Airflow's `_af` copies in MAIN lag behind, and four collections are missing there | the `tbl_ailabs_projectanalyzer_*_af` tables, then linked to Navgurukul / phase spec / rubric, with memberships |
| PA | MAIN `MAIN_PG_*`: `tbl_ghar_add_student`, `tbl_ghar_create_campus`, YT phase tables, weightages (Student Learning Dashboard) | mirrored; MAIN always wins |

A ledger table in TEST (`migration_sync_ledger`) remembers every row the sync wrote or confirmed. Each later run compares three things: the row in production now, the row in TEST now, and the ledger.

| Situation | Default | With `--source-wins` / `--final` |
|---|---|---|
| New in production | copied | copied |
| Changed in production only | updated | updated |
| Changed in TEST only (testing) | **kept**, counted | production's version |
| Changed on both sides | **kept TEST**, reported as CONFLICT | production's version |
| Deleted in production | reported | deleted (`--apply-deletes`) |
| Created in TEST (testers, new institutions) | **always kept** | kept (`--delete-test-only navgurukul` removes testers' Navgurukul rows; other institutions are never touched) |
| YT id taken by a TEST row, then used by MAIN | the TEST row moves to a new id (child rows follow), and MAIN's row keeps its id so links keep working | same |
| PA unique value (email, token…) on a TEST row | production row skipped, reported | TEST row replaced |

Other guarantees:

- **ID headroom.** After the first YT sync, the TEST id sequences sit 1,000,000 above MAIN's ids. Rows created in TEST then never collide with new production ids.
- **Rebuild guard.** `run.js` (both tools) refuses to rebuild once a sync has run, or once another institution has data, because rebuilding would TRUNCATE testers' and new institutions' rows. `--force-rebuild` overrides this.
- **Quick runs.** A normal PA run reads only MongoDB documents whose `updatedAt` changed since the last sync, plus new and deleted ones. `--full` (included in `--final`) re-reads everything, which catches raw updates that didn't touch `updatedAt`.

**First-run caveat.** Before the first sync there is no ledger. A row that was deleted in production after the initial copy therefore looks the same as a row created in TEST: both are reported as "created in TEST" with their ids. Look at those ids. `--delete-test-only navgurukul` at the final sync removes both kinds.

## During testing (now → switch day)

Run both syncs once a day, or before each test session. Dry run first if unsure.

```bash
cd yt-video-feedback/server
node scripts/multi-tenant/cutover/sync-from-main.js --dry-run   # what would change
node scripts/multi-tenant/cutover/sync-from-main.js              # report: cutover/last-sync-report.txt

cd athena-pa-admin
node scripts/multi-tenant/cutover/sync-from-main.js --dry-run
node scripts/multi-tenant/cutover/sync-from-main.js
```

Both scripts end with `RESULT: ALL CHECKS PASSED` (maybe with warnings to read). Then test both tools on TEST as before (`DB_TARGET=test`).

**Code drift check.** Every run warns when the production branch has commits that `feat/multi-tenant` lacks. That's `origin/master` for YT and `origin/rt_dev_v2` for PA; change it with `--main-ref`. It also warns when a file the DB config was seeded from changed:

- YT: `src/data/*.ts`
- PA: `evaluationFramework.js`, `phaseConfig.js`

Run `git fetch` first. Merge such changes into `feat/multi-tenant` (not the other way round), and update the TEST config to match, before switch day.

`cutover.js status` shows the last syncs and how many rows are tracked.

## Switch day

Pick a quiet hour. Times below are an example.

1. **Back up.** Take a `pg_dump` of `test_ghar_central_db`. It is about to become the live database. MAIN and MongoDB stay as they are; that is the rollback.
2. **Freeze production.** Stop the old YT server (`pm2 stop yt-video-feedback`) and the old PA server. Nothing may write to MAIN or MongoDB from now on.
3. **Final sync for both tools:**
   ```bash
   node scripts/multi-tenant/cutover/sync-from-main.js --final --dry-run   # look at it
   node scripts/multi-tenant/cutover/sync-from-main.js --final
   # optional: remove testers' Navgurukul rows (listed under "created in TEST")
   node scripts/multi-tenant/cutover/sync-from-main.js --delete-test-only navgurukul
   ```
   `--final` = `--source-wins --apply-deletes` (+ `--full` for PA). It FAILs on anything that still needs a decision: an unresolved collision, or code drift. Both must say `ALL CHECKS PASSED`.
4. **Mark the switch** in each tool. From now on `sync-from-main` refuses to run, and the rollback export knows where to start:
   ```bash
   node scripts/multi-tenant/cutover/cutover.js mark --note "switch day"
   ```
5. **Switch the environment.** The new code reads `TEST_PG_*` when `DB_TARGET=test`, so the production `.env` only gains variables:
   - **YT server** (`server/.env` on the EC2 box): add `DB_TARGET=test` and `TEST_PG_HOST/PORT/USER/PASSWORD/DATABASE/SSL` pointing at `test_ghar_central_db`. Keep the old `PG_*` lines; rollback uses them.
   - **PA server:** add `DATA_STORE=postgres`, `DB_TARGET=test`, `TEST_PG_*` and `PA_DEFAULT_INSTITUTION_SLUG=navgurukul`. Decide `PA_OPEN_ACCESS`: `true` lets anyone without a membership in as a Navgurukul student, like today. Keep `MONGO_URI`; rollback uses it.
6. **Deploy `feat/multi-tenant`** for YT (server + frontend) and PA (`athena-pa-admin` + `athena-pa-web`), without merging. `deploy.sh` resets to `master`, so check the branch out by hand on the box, or run it with the branch changed for this deploy. Note the commit that was running before; rollback returns to it.
7. **Smoke test:**
   - log in as a student, and check that the history pages show yesterday's evaluations and projects
   - submit one YT video and one PA project
   - open the Admin page
   - Student Learning Dashboard: rerun `sync-from-main.js --reference-only` (PA) on a schedule as long as the ghar pipeline still writes the student/campus tables into MAIN, or point that pipeline at TEST

## Rollback (if something is wrong after the switch)

1. **Export what was written to TEST since the switch.** This applies nothing.
   ```bash
   cd yt-video-feedback/server && node scripts/multi-tenant/cutover/rollback-export.js
   cd athena-pa-admin          && node scripts/multi-tenant/cutover/rollback-export.js
   ```
   - YT writes `cutover/rollback/yt-rollback-<time>.sql`: upserts into MAIN's own columns. YT ids from TEST are above 1,000,000, so they cannot collide with MAIN.
   - PA writes `cutover/rollback/pa-<time>/*.json` plus `import.sh`, for `mongoimport --mode upsert` into production MongoDB.
   - Only Navgurukul rows are exported by default (`--all-institutions` exports everything). Other institutions did not exist in the old app.
2. **Stop the new servers.** Deploy the previous commit (YT `master`, PA `rt_dev_v2`). Remove `DB_TARGET` / `TEST_PG_*` / `DATA_STORE` from the env, or comment them out.
3. **If you want the data written during the live period**, take a backup of MAIN / MongoDB first, then:
   ```bash
   psql "<MAIN>" -v ON_ERROR_STOP=1 -1 -f yt-rollback-<time>.sql
   MONGO_URI="<production mongodb uri with db name>" bash pa-<time>/import.sh
   ```
4. **Start the old servers.** If you switch again later, run `cutover.js unmark` and start again from "During testing". The daily sync picks production changes up again.

Rows deleted in TEST during the live period are not deleted in MAIN or MongoDB by the export.

## Files

| File | What it is |
|---|---|
| `sync-core.cjs` | ledger and three-way rules, MAIN→TEST table sync, id moves, drift check, rollback SQL (identical in both repos) |
| `sync-from-main.js` | the daily / final sync for this tool |
| `cutover.js` | `status` / `mark` / `unmark` |
| `rollback-export.js` | export of TEST rows since the switch, for the old database |
| `last-sync-report.txt`, `rollback/` | outputs (git-ignored; rollback files contain student data) |

Tables the sync adds to TEST: `migration_sync_ledger`, `migration_sync_runs`, `migration_cutover`.
