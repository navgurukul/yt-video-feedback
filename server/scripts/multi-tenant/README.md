# Multi-tenant test database

These scripts build the new multi-tenant architecture in the **test** database (`TEST_PG_*` in `server/.env`), filled with a copy of today's production data.

**Production (`PG_*`) is only read.** The connection opens with `default_transaction_read_only=on`, so Postgres itself rejects any write. The scripts also refuse to run if `TEST_PG_*` points to the same database as `PG_*`.

## Run

```bash
cd server
node scripts/multi-tenant/run.js --super-admin sachin.i@navgurukul.org
```

- You can re-run it at any time to refresh the test DB with the latest production data. Config IDs stay stable between runs.
- `--verify-only` re-checks the test DB without changing it.
- The report is written to `scripts/multi-tenant/last-run-report.txt`.

## What it does

| Step | File | Effect (TEST DB only) |
|---|---|---|
| 1 | `01-schema.sql` | Creates `institutions`, `programs`, `user_memberships`, `phases`, `rubrics`, `prompt_templates` and `video_assignments`. |
| 2 | `02-seed-config.js` | Adds Navgurukul → School of Programming: 7 phases, 70 concept videos, 7 project videos, 8 rubrics and 4 prompt templates (plus 4 global defaults). The source is `navgurukul-seed.json`, an exact snapshot of `src/data/*.ts`. |
| 3 | `03-copy-from-prod.js` | Copies the 6 legacy tables with production's exact column definitions and the same IDs. Adds the tenant columns and links every row to an institution, program, phase, video, rubric and prompts. Creates student and evaluator memberships for every existing user. |
| 4 | `04-verify.js` | Checks the copy and the config against production and the hardcoded files (see below). |

### What the verification checks

- The production connection is read-only.
- Row counts, IDs and per-user counts match production.
- No row is missing an `institution_id`.
- The syllabus in the DB is identical to the hardcoded files.
- The Gemini prompt text and config for every video match today's character for character.
- Old rows whose phase or video name is no longer in the syllabus are listed as WARN, not FAIL.

## Notes

- `rubrics.criteria` and `prompt_templates.generation_config` use the `JSON` type, not `JSONB`. `JSONB` re-orders keys, which would change the rubric text Gemini sees.
- If `src/data/*.ts` changes, regenerate `navgurukul-seed.json`. The verify step will FAIL until you do.
- `prompt-builder.js` reproduces how the app builds prompts today. The server will reuse it when it starts building prompts from the DB.

## Test suites (TEST database; nothing touches MAIN)

| Command | Checks | Saves output to |
|---|---|---|
| `node scripts/multi-tenant/test-auth.js` | 34 login and permission checks: students, evaluators, other institutions, failed requests | `last-test-auth.txt` |
| `node scripts/multi-tenant/test-admin.js` | 45 checks of the admin and super-admin APIs: versioning, validation, encryption, cloning | `last-test-admin.txt` |
| `node scripts/multi-tenant/test-prompts.js` | Server-built prompts identical to the legacy ones for all 147 video evaluations (dry run, no Gemini) | `last-test-prompts.txt` |
| `node scripts/multi-tenant/seed-demo.js --admin you@…` | Adds a Demo MBA College for trying a second institution in the UI | — |

## Moving to the main database

`promote/make-scratch.js`, `promote/promote.js` and `promote/down.sql`. Follow `docs/ROLLOUT.md`.
