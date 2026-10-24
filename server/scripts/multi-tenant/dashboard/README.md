# Campus Learning Dashboard (Superset) on the TEST database

Location: `yt-video-feedback/server/scripts/multi-tenant/dashboard/`. Run every command from `yt-video-feedback/server`.

Superset's **NayaGharCentralDB** connection is the YT tool's production database (`PG_*` in `server/.env`, `ghar_central_db`). This folder makes the same dashboard run entirely on **`test_ghar_central_db`** (`TEST_PG_*`):

- **YT and Project Analyzer data:** read from the new multi-tenant tables, Navgurukul rows only. The daily `cutover/sync-from-main.js` of both tools keeps them current.
- **Everything else the dashboard reads:** copied from production. MAIN is only read.
  - students, campuses and schools
  - leave and attendance
  - English write and speak grades
  - parameter weightages
  - the original syllabus tables

## Run

```bash
cd yt-video-feedback/server
node scripts/multi-tenant/cutover/sync-from-main.js                                       # YT data → TEST
(cd "../../Project Analyzer/athena-pa-admin" && node scripts/multi-tenant/cutover/sync-from-main.js)   # PA data → TEST
DASH_READER_PASSWORD='<password for superset_dash>' node scripts/multi-tenant/dashboard/run.js
```

`run.js` runs these steps:

| Step | What it does | Writes |
|---|---|---|
| `copy-dashboard-tables.js` | Copies the 10 non-tool tables from production; MAIN always wins. Re-creates the two production views (`v_ailabs_*`) in TEST and saves their definitions in `production-views/`. | TEST only |
| `apply-dash-views.js` | Rebuilds schema `dash`: one view per query in `superset-queries/`. With `DASH_READER_PASSWORD`, it also creates the read-only login `superset_dash`. That login can read only what the queries need: no password hashes, no API keys, no project code, no writes. | TEST only |
| `compare-old-new.js` | Compares old and new queries cell by cell (see below). | nothing (both read only) |

## SQL query for each dashboard component (`superset-queries/`)

Each file is one complete query for one chart. It runs on its own on the TEST database and returns exactly the production dataset's columns, in the same order. Each query reproduces the production query's rules on the new multi-tenant tables:

- **YT project video:** belongs to the phase it was saved under, by phase name.
- **Concept video:** matched by video title, or "title - phase name".
- **Video numbers:** as in the original syllabus table.
- **Project Analyzer projects:** matched to a phase through their phase spec.
- **Scores:** same weighted formula as production.
- **Component 07:** keeps the production view's `LIMIT 1000`.

| File | Chart | Production dataset it replaces |
|---|---|---|
| `01_campus_phase_progress.sql` | Campus Phase Progress | Campus Phase Progress |
| `02_campus_phase_timeline_score.sql` | Campus Phase Timeline & Score | Campus Phase Timeline & Score |
| `03_student_phase_submission_details.sql` | Student Phase Submission Details | Phase Submission Student Details |
| `04_student_missing_phase_submission_details.sql` | Student Missing Phase Submission Details | Student Missing Phase Submission Details |
| `05_student_current_phase_and_phase_scores.sql` | Student Current Phase and Phase Scores | Student Current Phase and Phase Scores |
| `06_concept_explanation_summary_view.sql` | Concept Explanation Summary View | Concept Explanation Summary View |
| `07_students_concept_explanation_analysis.sql` | Students Concept Explanation Analysis | view `v_ailabs_students_concept_explanationanalysis` |
| `08_phasewise_student_project_explanation_analysis.sql` | Phasewise Student Project Explanation Analysis | view `v_ailabs_phasewise_student_project_explanation_analysis` |
| `09_weekly_campus_learning.sql` | Weekly Campus Learning | Weekly Campus Wise Summary |

Two behaviours are kept from production on purpose, so the numbers match. Each query has a one-line comment showing how to change it:

- YT project videos saved under an **old phase name** are not counted, as in production. Using the phase link instead would count them.
- Component 07 shows only the **first 1000 rows**, ordered by email, phase and video. Students later in the alphabet don't appear, as in production.

**To build a chart from a query by hand:**

1. Open **SQL Lab** on the TEST connection, paste the file and click **Run**.
2. Click **Save → Save dataset**.
3. Create a **Table** chart with the columns from the file's header, then **Save → Add to dashboard**.

## Comparison: `compare-old-new.js` → `last-compare-report.txt` + `compare-out/*.csv`

For each of the 9 components, the script runs the **old** production query (`production-datasets/`) and the **new** query, then compares:

| Check | Compares | Answers |
|---|---|---|
| **QUERY CHECK** | old vs new query, both on TEST (same data) | Do the new queries compute exactly what the old ones did? |
| **END TO END** | old query on production vs new query on TEST | Will the new dashboard show what the current one shows? |
| **DATA CHECK** | old query on production vs old query on TEST | Is TEST's copy of the data complete? |

**IDENTICAL** means the same number of rows, the same columns in the same order, and every cell equal (compared as exact text). Otherwise the report lists:

- counts of differing cells, per column
- sample rows with the old and new values
- a reason per row

Every differing cell goes into `compare-out/<component>.csv`.

Known reasons:

- **Tool data differs between production and TEST** (sync not run yet, or testers' rows): run the syncs.
- **Rows of another institution:** the new queries are Navgurukul-only, so this only affects the query check.
- **UNEXPLAINED:** send me the CSV.

The **CONFIG CHECK** at the top compares the original syllabus tables (phase names, concept video titles) with the new multi-tenant configuration. Any difference there shows up in the components.

## Superset

Import `campus_learning_dashboard_multitenant.zip` (Dashboards → Import).

- **Connection:** the import creates **NayaGharTestDB (multi-tenant)**: `superset_dash@db-pg…/test_ghar_central_db`. Give the `superset_dash` password when asked.
- **Datasets and charts:** 9 SQL datasets named "… (TEST)", each holding the matching query, plus the 9 charts and the dashboard **Campus Learning Dashboard (Multi-tenant TEST)**.
- **Production is safe:** the production dashboard is untouched, because all UUIDs are new.

Optional: to read the campus and student tables live from production instead of copying them, run `10-main-ro-fdw.sql` (postgres_fdw, read only) and then `apply-dash-views.js --src main_ro`.
