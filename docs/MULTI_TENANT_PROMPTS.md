# Multi-Tenant Conversion — Step-by-Step Prompts

**Goal:** Turn `yt-video-feedback` from a Navgurukul School of Programming–only tool into a multi-tenant platform. A **Super Admin** creates institutions (Navgurukul branches, engineering colleges, MBA colleges, …). An **Institution Admin** defines their own syllabus (programs → phases → videos), rubrics and prompts. The 200+ active students and 1,700+ existing evaluations must keep working with zero data loss.

**How to use this file:** Paste **Prompt 0** into your coding agent (Claude Code, Copilot Chat, Cursor) first. Then paste Prompts 1–8 one at a time. Each prompt ends with a verification gate, so don't move on until the gate passes. Commit after every step.

**Time budget (realistic):** Steps 0–6 make up the core, about 5–6 focused hours. Step 7 (admin UI) takes 1.5–2 hours. Step 8 (rollout) takes about 1 hour. If you are short on time, ship Steps 0–6 with the JSON-editor admin from Step 7A, and do the polished UI (7B) the next day.

---

## Prompt 0 — Context, guardrails, and plan (paste first, no code changes)

```
You are working in the repo `yt-video-feedback` (React + TS + Vite frontend, Express backend in
server/index.js, PostgreSQL via `pg` Pool, Supabase Google OAuth, Gemini via @google/genai).
It evaluates student YouTube videos (concept-explanation and project-explanation) against rubrics.

CURRENT STATE (verify by reading the files, don't trust this blindly):
- Syllabus is hardcoded:
  - src/data/videoData.ts        → phases → concept videos {title, whatToCover, questionsToAnswer[]}
  - src/data/phasevideodata.ts   → one project video per phase {title, description, whatToCover, keyTopics[]}
  - src/data/RubricData.ts       → abilityToExplainRubric + Phase1Rubric..Phase7Rubric
                                   (rows: Parameter, "Weightage (%)", "Beginner (1)".."Expert (4)", Checklist[])
  - src/data/prompt.ts           → AccuracyPrompt/Config, AbilityToExplainPrompt/Config,
                                   ProjectPrompt/projectconfig, CustomPrompt/CustomConfig
                                   (configs = Gemini generationConfig incl. responseSchema, temperature 0, seed 42)
- src/pages/VideoAnalyzer.tsx imports those files, picks a rubric with a switch on phase, and POSTs
  {videoUrl, videoDetails, promptbegining, rubric, structuredreturnedconfig, apiKey, ...} to /evaluate.
  So the CLIENT sends the prompt and rubric to the server.
- server/index.js builds `promptbegining + videoDetails + "RUBRIC:\n" + JSON.stringify(rubric)` and
  calls Gemini (model fallback list GEMINI_MODELS).
- Tables: tbl_ailabs_ytfeedback_concept_evaluations, tbl_ailabs_ytfeedback_project_evaluation,
  tbl_ailabs_ytfeedback_custom_evaluations, tbl_manual_video_evaluations, tbl_llm_api_calls, tbl_user_issues.
  Identity is `email`. All migrations are in supabase/migrations/.
- SECURITY GAP: the backend trusts `email` from the query string or body (e.g. /concept-history?email=)
  and never verifies the Supabase JWT. /all-evaluations returns every student's data to any caller.
- AuthGate.tsx restricts login to @navgurukul.org.
- Gemini key: user-provided (localStorage 'gemini_api_key') or GEMINI_API_KEY env on the server.

TARGET:
- Tenancy hierarchy: Institution → Program (branch/course, e.g. "School of Programming", "MBA 2026")
  → Phase/Module (ordered) → Video Assignment (type: concept | project) with its expected content,
  linked Rubric(s) and Prompt Template(s). "Custom/other" evaluations stay available per institution.
- Roles: super_admin (global), institution_admin, evaluator (manual evaluation + view all in the
  institution), student.
- Navgurukul School of Programming becomes Institution #1 / Program #1, seeded from the hardcoded files,
  and must produce IDENTICAL prompt text, so evaluation quality does not change.

NON-NEGOTIABLE GUARDRAILS:
1. Production data is live (200+ students, 1,700+ evaluations). Migrations are ADDITIVE ONLY:
   new tables, new NULLABLE columns, then backfill. No DROP, no RENAME, no type changes on existing
   columns. Every migration must be idempotent (IF NOT EXISTS) and have a matching down script.
2. Keep the existing table names and endpoint paths working (add, don't break). Mark legacy paths
   deprecated instead of deleting them.
3. Keep the hardcoded src/data/* files until Step 8 sign-off. Keep a fallback: if DB config fails to
   load, the frontend can use the legacy data (feature flag VITE_USE_DB_CONFIG).
4. Small, reviewable commits. One step = one branch commit with a clear message.
5. Never log or return secrets. Institution Gemini keys are encrypted at rest.
6. After each step: run `npm run build` (frontend) and start the server, then report exactly what
   changed, which files, and how you verified it.

YOUR TASK NOW (no code changes yet):
a) Read the files listed above and confirm or correct my description of the current state.
b) Create git branch `feat/multi-tenant`.
c) Write docs/MULTI_TENANT_PLAN.md with: the ERD for the new tables, the role/permission matrix,
   the list of every endpoint and how it will be scoped, the list of every place hardcoded data is
   used, and risks.
d) Give me the exact pg_dump command to back up the production DB before Step 1. Don't run anything
   against production yourself.
Stop and wait for my review.
```

**Gate:** The plan doc matches reality, and you have taken a DB backup (`pg_dump`) before continuing.

---

## Prompt 1 — Database schema migration (additive + backfill)

```
Implement Step 1 from docs/MULTI_TENANT_PLAN.md: a new migration
supabase/migrations/<timestamp>_multi_tenant_foundation.sql plus a down script.

New tables (UUID PKs via gen_random_uuid(), created_at/updated_at timestamptz):
- institutions(id, name, slug UNIQUE, type TEXT /* school|college|university|bootcamp|other */,
  allowed_email_domains TEXT[] DEFAULT '{}', logo_url, gemini_api_key_encrypted TEXT NULL,
  settings JSONB DEFAULT '{}', status TEXT DEFAULT 'active')
- user_memberships(id, email CITEXT or lower()-indexed TEXT, institution_id NULL FK,
  role TEXT CHECK (role IN ('super_admin','institution_admin','evaluator','student')),
  program_id NULL FK, UNIQUE(email, institution_id, role))
  -- super_admin rows have institution_id NULL
- programs(id, institution_id FK, name, description, is_active, sort_order)
- phases(id, program_id FK, name, description, sort_order, is_active)
- rubrics(id, institution_id FK, name, rubric_type TEXT /* project|ability_to_explain|generic */,
  levels JSONB /* e.g. ["Beginner (1)",...,"Expert (4)"] */, criteria JSONB /* array of rows */,
  version INT DEFAULT 1, is_active BOOLEAN)
- prompt_templates(id, institution_id NULL FK /* NULL = global default */,
  kind TEXT CHECK (kind IN ('accuracy','ability_to_explain','project','custom')),
  name, prompt_text TEXT, generation_config JSONB /* temperature, seed, responseSchema... */,
  version INT DEFAULT 1, is_active BOOLEAN)
- video_assignments(id, phase_id FK, video_type TEXT CHECK (video_type IN ('concept','project')),
  title, description, what_to_cover TEXT, questions_to_answer JSONB DEFAULT '[]',
  key_topics JSONB DEFAULT '[]', rubric_id NULL FK, ability_rubric_id NULL FK,
  accuracy_prompt_id NULL FK, ability_prompt_id NULL FK, project_prompt_id NULL FK,
  sort_order, is_active)

Add NULLABLE columns (no defaults that rewrite the table) to:
- tbl_ailabs_ytfeedback_concept_evaluations, tbl_ailabs_ytfeedback_project_evaluation,
  tbl_ailabs_ytfeedback_custom_evaluations: institution_id UUID, program_id UUID, phase_id UUID,
  video_assignment_id UUID, rubric_id UUID, prompt_template_ids JSONB, config_snapshot JSONB
- tbl_manual_video_evaluations, tbl_llm_api_calls, tbl_user_issues: institution_id UUID
Add indexes on (institution_id, created_at DESC) and (institution_id, email).

Backfill in the same migration, inside a transaction:
- Insert institution 'Navgurukul' (slug 'navgurukul', allowed_email_domains '{navgurukul.org}').
- Insert program 'School of Programming' under it.
- UPDATE every existing evaluation, manual, metrics and issues row SET institution_id = navgurukul.id
  WHERE institution_id IS NULL.
- Insert a super_admin membership for an email I'll provide via a psql variable
  (:super_admin_email). Don't hardcode an email.

Do NOT touch Supabase RLS policies in this step (the backend connects with the pg role directly).
Also create scripts/verify-step1.sql that prints: row counts per evaluation table, and the count of
rows with institution_id IS NULL (must be 0).
Run it against a LOCAL copy of the DB restored from the backup, and show me the output.
```

**Gate:** Every table shows `institution_id IS NULL` = 0, and the row counts match the pre-migration counts (1,700+ total).

---

## Prompt 2 — Seed Navgurukul's syllabus, rubrics and prompts into the DB (with parity check)

```
Create scripts/seed-navgurukul.ts (run with `npx tsx`) that imports the EXISTING
src/data/videoData.ts, phasevideodata.ts, RubricData.ts and prompt.ts and inserts them for the
Navgurukul institution / 'School of Programming' program:

- One `phases` row per phase in videoDataStructure (keep the exact phase name strings and order).
- One concept `video_assignments` row per video (title, what_to_cover, questions_to_answer).
- One project `video_assignments` row per phase from projectVideoDataStructure
  (title, description, what_to_cover, key_topics).
- Rubrics: abilityToExplainRubric → rubric_type 'ability_to_explain'; Phase1Rubric..Phase7Rubric →
  rubric_type 'project'. Store `criteria` as the EXACT original array (same keys, including
  "Weightage (%)", "Beginner (1)" ... and "Checklist"), so JSON.stringify output is byte-identical.
- Prompt templates for kinds accuracy, ability_to_explain, project, custom with prompt_text = the
  exact exported string and generation_config = the exact exported config object.
- Link each video_assignment to the right rubric and prompts, replicating the switch in
  VideoAnalyzer.tsx (Phase N → PhaseNRubric, default Phase1Rubric).

The script must be idempotent (upsert on natural keys: institution+name, phase+title+type).

Then write scripts/parity-check.ts: for every phase/video, build the payload the OLD frontend would
send (videoDetails string exactly as VideoAnalyzer builds it today, rubric, prompt, config) and
the payload built from the DB rows, and deep-compare them. Print PASS/FAIL per video and exit
non-zero on any mismatch.
Extract the videoDetails-building logic from VideoAnalyzer.tsx into a shared pure function
(e.g. shared/buildVideoDetails.ts) used by both the frontend and server, with no behaviour change.
```

**Gate:** `parity-check` prints PASS for every concept and project video in all 7 phases.

---

## Prompt 3 — Real authentication + tenant context on the backend

```
Secure the backend and add tenant context.

1. server/middleware/auth.js:
   - Read `Authorization: Bearer <supabase access token>`; verify it with
     supabase.auth.getUser(token) using SUPABASE_URL + SUPABASE_ANON_KEY (or verify the JWT locally
     with SUPABASE_JWT_SECRET, which is faster; pick one and explain why).
   - Attach req.user = { email (lowercased), id }.
   - Resolve memberships from user_memberships. If none exist, auto-join as 'student' when the email
     domain matches an active institution's allowed_email_domains (insert a membership row). Otherwise
     respond 403 { code: 'NOT_ENROLLED' }.
   - Attach req.tenant = { institutionId, role, programId }. If the user has several institutions,
     honour an `X-Institution-Id` header only if they have a membership there.
   - Helpers: requireRole('super_admin'|'institution_admin'|'evaluator'|...), with super_admin
     passing every check.
2. Apply it to ALL existing endpoints except /health. Then:
   - Ignore `email` from query/body; use req.user.email. Keep accepting the param so old clients
     don't 400, but log a deprecation warning.
   - Every SELECT/DELETE adds `AND institution_id = $X`. Every INSERT writes institution_id
     (and program_id/phase_id/video_assignment_id when known).
   - Students see only their own rows. /all-evaluations and the manual-eval endpoints require
     evaluator or institution_admin, scoped to their institution. super_admin can pass
     ?institutionId= to view any tenant.
   - DELETE is allowed only by the row owner or institution_admin.
3. Frontend: create src/lib/api.ts with apiFetch(path, opts) that adds the Supabase access token
   and X-Institution-Id, and replace every raw fetch to VITE_API_URL / VITE_EVAL_API_URL with it.
4. Move CORS origins to an env var CORS_ORIGINS (comma-separated), defaulting to the current list.
5. Remove the hardcoded @navgurukul.org restriction from AuthGate.tsx. Access is now decided by the
   backend (NOT_ENROLLED shows a friendly "Your institution hasn't been set up yet; contact your admin"
   screen).

Add a small test script (scripts/test-auth.sh with curl) proving that: no token → 401;
student A cannot read student B's evaluation by id; a student cannot call /all-evaluations;
a Navgurukul admin cannot see another institution's rows.
```

**Gate:** The auth test script passes, and an existing student logs in and still sees their full history.

---

## Prompt 4 — Config & admin APIs

```
Add REST APIs in server/routes/ (split out of index.js; keep index.js as the bootstrap). Validate
all bodies with zod.

Read (any member):
- GET /api/me → { email, memberships[], activeInstitution {id,name,logo_url,settings} }
- GET /api/config → for the active institution: programs → phases → video_assignments
  (with rubric & prompt ids), only is_active rows, ordered by sort_order. Cache in memory for 60s,
  keyed by institution and invalidated on writes.

Institution admin (scoped to req.tenant.institutionId):
- CRUD /api/admin/programs, /api/admin/phases, /api/admin/videos (with reorder endpoints)
- CRUD /api/admin/rubrics. Validation: at least one criterion; each criterion has a name, a weight
  and a descriptor for every level; weights sum to 100 (warn, don't block, for ability_to_explain).
  Editing creates a NEW version row (version+1) and leaves old rows untouched, so past evaluations
  keep pointing at the exact rubric they were graded with.
- CRUD /api/admin/prompts. Same versioning. Validate generation_config.responseSchema is valid JSON
  and that the required output fields the results page depends on are present for that kind.
  Allow an "inherit global default" option (institution_id NULL templates).
- /api/admin/users: list, invite (email + role), change role, remove. Edit allowed_email_domains.
- PUT /api/admin/settings: name, logo_url, Gemini API key (encrypt with AES-256-GCM using
  ENCRYPTION_KEY from env; never return it, only `hasKey: true` and the last 4 characters).
- POST /api/admin/prompts/:id/test { videoUrl, videoAssignmentId } → runs a dry evaluation without
  storing it, so admins can try a prompt before activating it.
- GET /api/admin/stats → evaluations per program/phase, active students, LLM token usage
  (from tbl_llm_api_calls) for the last 30 days.

Super admin:
- CRUD /api/super/institutions (create institution + first institution_admin in one call;
  optionally "clone from template institution", which copies programs/phases/videos/rubrics/prompts,
  useful for new Navgurukul branches).
- GET /api/super/stats across all institutions.

Write docs/API.md listing every endpoint, its role requirement and an example body.
```

**Gate:** You can create a test institution "Demo MBA College" with curl, add a program, phase, rubric, prompt and video, and `GET /api/config` as that institution's student returns them.

---

## Prompt 5 — Server-side evaluation from DB config

```
Refactor POST /evaluate so the server, not the client, owns prompts and rubrics.

- New request shape: { videoUrl, videoAssignmentId, evaluationKind
  ('accuracy'|'ability_to_explain'|'project'|'custom'), customPrompt?, customContext?, model? }.
- The server loads the video_assignment (must belong to req.tenant.institutionId), its linked
  rubric and prompt template, builds videoDetails with shared/buildVideoDetails.ts, and composes
  the prompt in EXACTLY the same order and format as today:
  prompt_text + videoDetails + "RUBRIC:\n" + JSON.stringify(criteria).
  Use generation_config from the template.
- API key precedence: institution key (decrypted) → user-supplied key in the request → GEMINI_API_KEY env.
  Keep the existing user key modal working.
- Keep the existing model fallback logic, metrics logging (now with institution_id) and error mapping.
- Legacy path: if the body contains `promptbegining` and no videoAssignmentId, run the old code path
  and log a deprecation warning. Remove it in Step 8.
- /store-evaluation (or merge storing into /evaluate; your call, explain it): persist institution_id,
  program_id, phase_id, video_assignment_id, rubric_id, prompt_template_ids and a config_snapshot
  ({rubric_version, prompt_versions, model}) on the evaluation row. Keep writing all legacy columns
  (project_name, page_name, etc.) so History, AllEvaluations and the dashboards keep working.

Verification: pick 3 previously evaluated videos (1 concept and 1 project from Phase 1,
1 project from Phase 3). Log the composed prompt from the new path and diff it against the legacy
path. The diff must be empty.
```

**Gate:** Empty prompt diff for all 3 videos, and new rows saved with `institution_id` and `config_snapshot` set.

---

## Prompt 6 — Frontend reads config dynamically

```
Make the student-facing UI data-driven.

- src/hooks/useInstitutionConfig.ts: react-query hook over GET /api/config and /api/me.
  Behind VITE_USE_DB_CONFIG (default true), fall back to the legacy src/data/* if the request fails.
- VideoAnalyzer.tsx: replace the imports from src/data/* and the phase→rubric switch with config:
  Program select (hidden if only one) → Phase select → Video select (filtered by video type).
  Send the new /evaluate request shape (videoAssignmentId). Keep the "other/custom" flow.
- AnalysisResults.tsx: render rubric parameters, weights and levels from the stored rubric
  (fetch by rubric_id, or read config_snapshot) instead of assuming the Navgurukul column names.
  Old rows without rubric_id must still render exactly as they do today.
- Header/Footer: show the active institution's name and logo (fall back to the NG logo).
  Add an institution switcher if the user has more than one membership.
- History.tsx, AllEvaluations.tsx, ManualEvaluation.tsx: use apiFetch, show program/phase filters
  from config, and show the AllEvaluations/Manual nav links only for evaluator/admin roles.
- Replace user-facing strings that say "School of Programming", "HTML", "Navgurukul" etc. with
  config values or neutral wording.

Run `npm run build` and `npm run lint`. Then do a manual click-through as a Navgurukul student for
a concept video and a project video and confirm the results page looks the same as before.
```

**Gate:** A Navgurukul student's experience is unchanged, and a Demo MBA student sees only MBA phases and videos.

---

## Prompt 7 — Admin & Super Admin UI

**7A (minimum, ~45 min):**

```
Add /admin and /super-admin routes, guarded by role from /api/me.
For a fast first version, use simple shadcn tables + forms for institutions, programs, phases, videos
and users, and a JSON editor (textarea with validate + pretty-print) for rubric criteria and
prompt generation_config. Show zod validation errors inline. Every save creates a new version
for rubrics/prompts (show the version history list with "restore").
```

**7B (polish, ~1–1.5 hrs):**

```
Improve the admin UX:
- Syllabus builder: Program → Phase → Video tree with drag-to-reorder and active toggles.
- Rubric editor: a grid where rows are criteria (name, weight %, checklist items) and columns are
  levels (editable level names, default Beginner/Intermediate/Advanced/Expert); a live weight total
  that turns red when it isn't 100.
- Prompt editor: textarea with a sidebar listing what the server appends automatically
  (VIDEO DETAILS, RUBRIC) and the required output fields for the kind; "Test on a YouTube URL"
  button calling /api/admin/prompts/:id/test and showing the raw JSON + rendered result.
- Starter templates: when creating an institution, offer "Start blank", "Clone Navgurukul School
  of Programming" or "Generic presentation rubric" (good for MBA/engineering: Content accuracy,
  Structure, Communication, Use of examples, Q&A readiness).
- Users page: invite by email, assign role/program, bulk-add via CSV paste, edit allowed domains.
- Super admin dashboard: institutions table (students, evaluations, tokens last 30 days, status),
  create institution + first admin, suspend institution.
- Settings: institution name, logo upload (URL is fine), Gemini key (masked).
```

**Gate:** Without touching code, a new institution admin can set up a program with 1 phase, 1 concept video and 1 project video with a custom rubric, and a student there completes an evaluation.

---

## Prompt 8 — Regression, rollout, cleanup

```
Prepare the production rollout.

1. Write docs/ROLLOUT.md with the exact order:
   backup (pg_dump) → run the Step 1 migration → run seed-navgurukul.ts → run parity-check.ts →
   deploy the backend (new env: SUPABASE_URL, SUPABASE_ANON_KEY/JWT secret, ENCRYPTION_KEY,
   CORS_ORIGINS) → deploy the frontend (Amplify) → smoke test → announce.
   Include a rollback plan: the frontend falls back via VITE_USE_DB_CONFIG=false; the backend legacy
   /evaluate path still exists; the down migration only drops NEW tables/columns and is only run if needed.
2. Regression checklist (run it and report results): old evaluation detail pages for 5 random old
   rows (concept, project, custom, manual) render correctly; History counts per user match the
   pre-migration counts; the API key modal still works; error panels still map Gemini errors;
   the dashboard queries in docs/dashboard/ still work (they now need an institution filter;
   update them).
3. Update README.md, .github/copilot-instructions.md and src/Docs/* for the new architecture.
4. After 1 week of stable production, open a follow-up PR (not now) that removes the legacy
   /evaluate path, the email query params and the src/data/* fallback files.
```

**Gate:** Navgurukul students evaluate normally on production, and one external pilot institution is onboarded.

---

## Decisions baked in (change before starting if you disagree)

| Decision | Choice | Why |
|---|---|---|
| Hierarchy | Institution → Program → Phase → Video | Covers Navgurukul branches (as programs or separate institutions) and colleges (course/semester as program). |
| Existing tables | Keep names, add `institution_id` | Zero-risk for 1,700+ rows and the existing dashboards. |
| Who builds prompts | Server, from the DB | Prevents students tampering with prompts/rubrics, and enables versioning. |
| Rubric/prompt edits | New version rows, never in-place | Old evaluations stay explainable. |
| Login | Supabase Google OAuth kept; access by membership or allowed email domain | No new auth system needed. |
| Gemini key | Per-institution (encrypted) → user key → server env | Each institution pays for its own usage. |
| Branch vs institution | Other Navgurukul schools can be **programs** under Navgurukul, or separate institutions cloned from it | Super admin decides per case. |
