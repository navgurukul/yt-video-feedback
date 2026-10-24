# Campus Learning Dashboard (Superset) on the TEST database

Superset's **NayaGharCentralDB** connection is the YT tool's production database (`PG_*` in `server/.env`, `ghar_central_db`). This folder makes the same dashboard run entirely on **`test_ghar_central_db`** (`TEST_PG_*`).

**What comes from where:**

- **Copied from production:** the tables the dashboard reads that the tools don't own. MAIN is only read.
  - `tbl_ghar_add_student`, `tbl_ghar_create_campus`, `tbl_ghar_assign_school_to_campus`
  - `tbl_ghar_Write_Improve_Data`, `tbl_ghar_Speak_Improve_Data`
  - `tbl_ghar_apply_leave`, `tbl_ghar_leave_type`
  - `tbl_ailabs_phasewise_parameter_weightages`
  - `tbl_ailabls_ytfeedback_phases`, `tbl_ailabls_ytfeedback_phasevideos`
- **Re-created in TEST** from their production definitions: the two MAIN views `v_ailabs_students_concept_explanationanalysis` and `v_ailabs_phasewise_student_project_explanation_analysis`.
- **Already in TEST:** the YT / Project Analyzer data, the multi-tenant one kept current by the daily `cutover/sync-from-main.js` of both tools.
- **Built on top:** `dash.*` views, one per Superset dataset, that read the new multi-tenant structure (phases, phase links, phase specs) and are scoped to Navgurukul.

## Run (from `yt-video-feedback/server`, on a machine that can reach RDS)

```bash
# 0. tool data current in TEST
node scripts/multi-tenant/cutover/sync-from-main.js                              # YT
(cd "../../Project Analyzer/athena-pa-admin" && node scripts/multi-tenant/cutover/sync-from-main.js)   # PA (MongoDB)

# 1–3. copy dashboard tables + views, build dash.* views, verify against production
DASH_READER_PASSWORD='<password for superset_dash>' node scripts/multi-tenant/dashboard/run.js
```

`run.js` runs these three steps; each can also be run alone:

| Step | What it does | Writes |
|---|---|---|
| `copy-dashboard-tables.js [--dry-run]` | Copies the 10 tables. MAIN always wins, so TEST becomes an exact copy: rows added or edited in TEST are reset or removed. Re-creates the two views (and any views or tables they need) from `pg_get_viewdef`. Saves the production definitions in `production-views/`. | TEST only |
| `apply-dash-views.js [--src public\|main_ro]` | Rebuilds schema `dash` from `dash-views.sql`. With `DASH_READER_PASSWORD`, it also creates the read-only login `superset_dash`, which can see only `dash`. | TEST only |
| `verify-dashboard.js [--samples N]` | For every production dataset and both views, runs the production SQL on MAIN and compares it with the same SQL on TEST (**MIGRATION**) and with the `dash.*` view (**NEW VIEW**). For each differing student it shows their tool-row counts on both sides. Report: `last-verify-report.txt`. | nothing (both read only) |

Keep running `copy-dashboard-tables.js` with the daily sync until the switch. The ghar tables keep changing in MAIN. The Project Analyzer sync (`--reference-only`) copies the same 10 tables too.

## Reading the verify report

- **MIGRATION SAME** means TEST holds the same data the production queries see. Expected differences:
  - production rows newer than the last sync
  - rows testers created in TEST
  - Project Analyzer projects newer in TEST: TEST syncs them from MongoDB, while MAIN's `_af` tables are Airflow's delayed copy
- **NEW VIEW SAME** means the multi-tenant `dash.*` query gives the production numbers. Expected differences:
  - evaluations saved under **old phase names**: production silently drops them, the new views count them
  - the two `v_ailabs_*` views: `dash.*` is a re-implementation from the columns only. Compare it with `production-views/*.sql` after the first copy.
- A line ending in `(same data → query logic)` is a real query difference to look at. `(data differs)` means the student's tool data isn't the same on both sides yet.

## Superset

Import `campus_learning_dashboard_multitenant.zip` (Dashboards → Import).

- The import creates the connection **NayaGharTestDB (multi-tenant)**: `superset_dash@db-pg…/test_ghar_central_db`. Give the `superset_dash` password when asked.
- It also creates 9 datasets (`dash.*`) and the dashboard **Campus Learning Dashboard (Multi-tenant TEST)**.
- The production dashboard is untouched: all UUIDs are new.
- Tested on Superset 6.1.0, the version the export came from.

Alternatives:

- **Read MAIN's tables live** instead of copying them: `10-main-ro-fdw.sql` (postgres_fdw, read only) and `apply-dash-views.js --src main_ro`.
- **Keep the production SQL:** after the copy, every production dataset query also runs unchanged on TEST. To keep the old SQL, point the old datasets at the TEST connection.
