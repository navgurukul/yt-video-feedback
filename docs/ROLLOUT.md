# Rollout: multi-tenant architecture → main database

The `feat/multi-tenant` branch runs on the TEST database today. This is the checklist for moving it to the main database (`ghar_central_db`) and production.

> **Who runs what:** every step that writes to MAIN is run by you, from your Mac, after a backup. The scripts refuse to touch MAIN without `--i-have-a-backup`, and they ask you to type the database name.

## 0. Before the day

- [ ] All checks pass on TEST:
  - `run.js` → ALL CHECKS PASSED
  - `test-auth.js` → 34/34
  - `test-admin.js` → 45/45
  - `test-prompts.js` → 10/10
- [ ] Click-through on TEST as Navgurukul:
  - Concept and project evaluations work.
  - History matches the live site.
  - Failed requests: save, retry and delete.
  - The rubric guide opens.
  - Admin and Super Admin screens work.
- [ ] Decide which TEST institutions to promote. Default: `navgurukul` only. Demo and test colleges stay in TEST.
- [ ] **Rehearsal on a scratch copy of MAIN:**
  1. Create an empty database `scratch_ghar_central_db` on the RDS server.
  2. Add `SCRATCH_PG_*` to `server/.env`.
  3. Run:
     ```bash
     cd server
     node scripts/multi-tenant/promote/make-scratch.js        # copies MAIN's legacy tables (MAIN read-only)
     node scripts/multi-tenant/promote/promote.js --target scratch
     ```
  4. Expect `RESULT: ALL CHECKS PASSED` (also saved in `promote/last-promote-scratch.txt`).
  5. Optional: point a local server at the scratch DB and click through.
- [ ] Production env values are ready (see step 3).
- [ ] Pick a quiet time (≈30 min). Tell students evaluations may pause for a few minutes.

## 1. Backup MAIN

```bash
pg_dump "host=<PG_HOST> port=5432 dbname=ghar_central_db user=<PG_USER> sslmode=require" \
  -Fc -f ghar_central_db_$(date +%Y%m%d_%H%M).dump
```

Keep the file somewhere safe. Restoring later uses `pg_restore -d <db> --clean <file>`.

## 2. Promote MAIN (additive only)

```bash
cd server
node scripts/multi-tenant/promote/promote.js --target main --i-have-a-backup
# type: ghar_central_db
```

What happens:

1. New config tables are created.
2. Nullable tenant columns are added to the 7 legacy tables.
3. Navgurukul's configuration is copied from TEST, keeping the same UUIDs.
4. Every existing row is linked to Navgurukul and its phase, video and rubric.
5. Student and evaluator memberships are created.
6. The 05/06/07 settings are applied.
7. Everything is verified.

The old (master) app keeps working throughout. It ignores the new columns.

Expect `RESULT: ALL CHECKS PASSED`. The result is saved in `promote/last-promote-main.txt`.

## 3. Deploy the backend (EC2)

1. Merge `feat/multi-tenant` into `master` via a PR. Pushing `master` triggers `.github/workflows/deploy.yml`.
2. On EC2, `server/.env` needs these values:

   | Variable | Value |
   |---|---|
   | `DB_TARGET` | `prod`. Leave unset only if there is **no** `TEST_PG_*` on EC2. |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Same project as the frontend; the publishable key is fine. |
   | `ENCRYPTION_KEY` | A **new** random 64-hex-char string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never change it afterwards, or saved Gemini keys can't be read. |
   | `CORS_ORIGINS` | e.g. `https://master.d33dd8pvqtvje3.amplifyapp.com,<other frontend URLs>` |
   | `GEMINI_API_KEY` | Optional, as today. |

3. **New dependency:** the server now needs `zod`. Make sure the deploy installs `server/` dependencies (`cd server && npm install --omit=dev`). The current workflow only runs `npm install` at the repo root, so add the `server/` install to `deploy.yml` / `deploy.sh` if the API runs from `server/`.
4. Restart: `pm2 restart yt-video-feedback`. The log must show:
   `Connected to PostgreSQL: target=prod database=ghar_central_db read_only=off`

## 4. Link rows written during the switch

The old app may have saved evaluations between step 2 and step 3. Link them:

```bash
node scripts/multi-tenant/promote/promote.js --target main --i-have-a-backup --backfill-only
```

This only touches rows that aren't linked yet.

## 5. Deploy the frontend (Amplify)

Amplify builds from `master` automatically. There are no new build variables. `VITE_USE_DB_CONFIG` defaults to on; set it to `false` only for an emergency fallback.

## 6. Smoke test (production)

- [ ] Sign in as a student: history shows the same items as before.
- [ ] An old result opens.
- [ ] A concept evaluation and a project evaluation succeed and appear in history.
- [ ] Failed Request Recovery lists, retries and deletes correctly.
- [ ] As an evaluator: All Evaluations and Manual Evaluation load.
- [ ] As super admin: the Admin and Super Admin pages load.
- [ ] A student can't open another student's result by changing the id in the URL.

## Rollback

Pick the lightest option that fixes the problem:

| Problem | Action |
|---|---|
| Frontend issue in the new syllabus flow | Amplify env `VITE_USE_DB_CONFIG=false` and rebuild. The analyzer uses the built-in syllabus and client-built prompts, which the server still accepts. |
| Backend issue | Redeploy the previous `master` commit (`git revert` the merge, push). The old app ignores the new columns and tables, so no DB change is needed. |
| Must remove the new schema | After the old app is back: `psql "<MAIN>" -f server/scripts/multi-tenant/promote/down.sql`. It drops only the new tables and columns. Last resort: `pg_restore` the backup from step 1. |

## After a stable week (follow-up PR)

- Remove the legacy `/evaluate` path (client-built prompts) and the `email` query/body parameters.
- Remove the `src/data/*` fallback and the `VITE_USE_DB_CONFIG` switch.
- Update the queries in `docs/dashboard/*` with an `institution_id` filter.
