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
| `apply-dash-views.js [--src public\|main_ro]` | Rebuilds schema `dash` from `dash-views.sql`. With `DASH_READER_PASSWORD`, it also creates the read-only login `superset_dash`, which can read the `dash` views and the columns the `superset-queries/` need, and nothing else. | TEST only |
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

## SQL query for each dashboard component (`superset-queries/`)

Each file is one complete query for one chart. It runs on the **TEST** database on its own (no views needed) and returns the same columns as the production dataset, so the chart settings stay the same. Run `copy-dashboard-tables.js` first: the queries read the copied student, campus, grade and leave tables from TEST.

| File | Chart | Production dataset it replaces | Chart type / columns (as production) |
|---|---|---|---|
| `01_campus_phase_progress.sql` | Campus Phase Progress | Campus Phase Progress | Table (raw): campus_name, school_name, total_students, avg_write_grade, avg_speak_grade, phase1–phase7 |
| `02_campus_phase_timeline_score.sql` | Campus Phase Timeline & Score | Campus Phase Timeline & Score | Table (raw): campus_name, school_name, phase_name, student_count, avg_time_days, avg_score |
| `03_student_phase_submission_details.sql` | Student Phase Submission Details | Phase Submission Student Details | Table (raw): campus_name, school_name, student_name, email, phase_name, first_submission; time filter first_submission |
| `04_student_missing_phase_submission_details.sql` | Student Missing Phase Submission Details | Student Missing Phase Submission Details | Table (raw): campus_name, school_name, student_name, email, phase_name, last_submitted_phase |
| `05_student_current_phase_and_phase_scores.sql` | Student Current Phase and Phase Scores | Student Current Phase and Phase Scores | Table (raw): campus_name … phase7_score (18 columns); time filter joining_date |
| `06_concept_explanation_summary_view.sql` | Concept Explanation Summary View | Concept Explanation Summary View | Table (raw): email, phase_name, videos_cleared, video_cleared_accuracy, last_ability_to_explain_level |
| `07_students_concept_explanation_analysis.sql` | Students Concept Explanation Analysis | view v_ailabs_students_concept_explanationanalysis | Table (raw): 13 columns; time filter evaluated_at |
| `08_phasewise_student_project_explanation_analysis.sql` | Phasewise Student Project Explanation Analysis | view v_ailabs_phasewise_student_project_explanation_analysis | Table (aggregate, group by all 9 columns); time filter evaluated_at |
| `09_weekly_campus_learning.sql` | Weekly Campus Learning | Weekly Campus Wise Summary | Table (aggregate, group by all 8 columns); time filter week |

**To create a chart from a query by hand:**

1. Open **SQL → SQL Lab**, select the TEST connection, and paste the file.
2. Click **Run**, then **Save → Save dataset**, and give it a name.
3. In the chart editor, pick **Table**, add the columns listed above, then **Save → Add to dashboard**.

**Tested** on a production-like replica: the real syllabus, rubrics and weightages, and students with and without submissions under old phase names.

- **Matches production.** Queries 01–06 and 09 return exactly the rows the production SQL returns on MAIN. Where they differ, every differing student is one with submissions under an old phase name: production drops those rows, the new queries count them.
- **Matches the views.** Every query returns the same rows as its `dash.*` view.
- **Superset login.** All 9 run under the read-only login `superset_dash`, which can't see password hashes, API keys or project code, and can't write.

## Superset

Import `campus_learning_dashboard_multitenant.zip` (Dashboards → Import).

- The import creates the connection **NayaGharTestDB (multi-tenant)**: `superset_dash@db-pg…/test_ghar_central_db`. Give the `superset_dash` password when asked.
- It also creates 9 SQL datasets named "… (TEST)", each holding the matching query from `superset-queries/`, plus the 9 charts and the dashboard **Campus Learning Dashboard (Multi-tenant TEST)**.
- The production dashboard is untouched: all UUIDs are new.
- Tested on Superset 6.1.0, the version the export came from.

Alternatives:

- **Read MAIN's tables live** instead of copying them: `10-main-ro-fdw.sql` (postgres_fdw, read only) and `apply-dash-views.js --src main_ro`.
- **Keep the production SQL:** after the copy, every production dataset query also runs unchanged on TEST. To keep the old SQL, point the old datasets at the TEST connection.
