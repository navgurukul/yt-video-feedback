# Multi-Tenant Plan (Prompt 0 output)

Branch: `feat/multi-tenant` (created from `master` @ `54db6bc`).
Development DB: **test_ghar_central_db** (`TEST_PG_*`). Main DB `ghar_central_db` (`PG_*`) is **read-only** until Prompt 8.

## 1. Current state — verified, with corrections

The description in Prompt 0 is accurate. Things the code review added or corrected:

| # | Finding | Where |
|---|---|---|
| 1 | Backend never verifies identity. History endpoints take `?email=`. **GET and DELETE `/…-evaluation/:id` only check `WHERE id = $1`**, so anyone can read or delete any evaluation by guessing ids. | `server/index.js` 1131–1435 |
| 2 | `/all-evaluations` and `/manual-eval-videos` have no auth at all. The Header link to All Evaluations is commented out on desktop but still present in the mobile menu. | `index.js` 1549, 1440; `Header.tsx` 149, 240 |
| 3 | `/manual-eval-videos` hardcodes excluded emails (`sachin.i@`, `rishav@navgurukul.org`). This becomes a per-institution setting. | `index.js` ~1461 |
| 4 | **ManualEvaluation.tsx also imports Phase1–7 rubrics** and picks one by `project_name.includes("phase N")`. This is a second copy of the phase→rubric switch. | `ManualEvaluation.tsx` 10, 36–45 |
| 5 | AnalysisResults.tsx falls back to a **hardcoded mock rubric** (an old 3-criteria HTML rubric) when neither route state nor the DB row has a rubric. It assumes the column names `Weightage (%)` and `Beginner (1)`…`Expert (4)`. | `AnalysisResults.tsx` 43–70, 511–560 |
| 6 | The pg config is inline in `index.js` (lines 41–55). There's no DB module yet, so Prompt 2 extracts one. | `index.js` |
| 7 | The `.env` files are git-ignored. `docs/` and `server/scripts/` are currently untracked. | — |
| 8 | Sorting in `/all-evaluations` is done in JS with whitelisted fields, so there's no SQL injection risk there. | `index.js` 1654 |

## 2. Test DB — ERD

```
institutions 1──* programs 1──* phases 1──* video_assignments *──1 rubrics
     │                                         │  (rubric_id, ability_rubric_id)
     │                                         └─*──1 prompt_templates (accuracy/ability/project)
     ├──* rubrics            (versioned: name+version unique, criteria JSON)
     ├──* prompt_templates   (versioned; institution_id NULL = global default)
     └──* user_memberships   (email, role, program_id; super_admin has institution_id NULL)

Legacy tables (same names, same ids as production, plus tenant columns):
  tbl_ailabs_ytfeedback_concept_evaluations ┐ + institution_id, program_id, phase_id,
  tbl_ailabs_ytfeedback_project_evaluation  ├   video_assignment_id, rubric_id,
  tbl_ailabs_ytfeedback_custom_evaluations  ┘   prompt_template_ids JSONB, config_snapshot JSONB
  tbl_manual_video_evaluations ─FK→ project_evaluation      + institution_id
  tbl_llm_api_calls, tbl_user_issues                         + institution_id
```

Planned additions (each a numbered file registered in `run.js`):

| File | Prompt | Contents |
|---|---|---|
| `05-legacy-name-mapping.sql` | 1 | `legacy_name_map(old_phase, old_title, video_assignment_id)` + UPDATE, only if WARNs need it. |
| `06-auth.sql` | 3 | Index on `user_memberships(lower(email))`; `institutions.settings.manual_eval_excluded_emails`. |
| `07-admin.sql` | 4 | `audit_log(institution_id, actor_email, action, entity, entity_id, diff JSON, created_at)`. |

## 3. Roles & permissions

| Action | student | evaluator | institution_admin | super_admin |
|---|:-:|:-:|:-:|:-:|
| Evaluate own videos, view/delete own history | ✓ | ✓ | ✓ | ✓ |
| View all evaluations in the institution | | ✓ | ✓ | ✓ (any) |
| Manual evaluation | | ✓ | ✓ | ✓ |
| Delete others' evaluations | | | ✓ | ✓ |
| Edit programs/phases/videos/rubrics/prompts | | | ✓ | ✓ |
| Manage users, domains, Gemini key, branding | | | ✓ | ✓ |
| Create/suspend institutions, cross-tenant stats | | | | ✓ |

Access rules:
- A user with no membership but an email domain in an active institution's `allowed_email_domains` is auto-joined as a student.
- Anyone else gets `NOT_ENROLLED`.

## 4. Endpoint scoping

All endpoints except `/health` require `Authorization: Bearer <supabase token>`. The identity always comes from the token, never from the `email` param.

| Endpoint | Today | After |
|---|---|---|
| POST `/evaluate` | open; client sends prompt + rubric | member; server builds from `videoAssignmentId` (legacy body accepted, deprecated) |
| POST `/store-evaluation` | open; trusts `userEmail` | member; writes `institution_id` + links + `config_snapshot` |
| GET `/concept-history`, `/project-history`, `/custom-history` | `?email=` | own rows in the active institution |
| GET `/concept-evaluation/:id` (and project, custom) | id only | owner, or evaluator/admin of the same institution |
| DELETE `/…-evaluation/:id` | id only | owner or institution_admin, same institution |
| GET `/all-evaluations` | open | evaluator / institution_admin (scoped); super_admin `?institutionId=` |
| GET `/manual-eval-videos`, POST `/manual-evaluation` (+ `/api/` aliases) | open | evaluator / institution_admin, scoped |
| NEW `/api/me`, `/api/config` | — | member |
| NEW `/api/admin/*` | — | institution_admin |
| NEW `/api/super/*` | — | super_admin |

## 5. Hardcoded data in the frontend → replacement

| File | Hardcoded | Replaced by (Prompt 6) |
|---|---|---|
| `VideoAnalyzer.tsx` 18–21, 146–200, 590–615 | phases, videos, project videos, rubric switch, all prompts + configs | `useInstitutionConfig()` + server-side prompt building |
| `ManualEvaluation.tsx` 10, 36–45 | Phase1–7 rubrics, "phase N" matching | rubric via the row's `rubric_id` |
| `AnalysisResults.tsx` 43–70 | mock HTML rubric fallback, fixed level/weight keys | stored rubric / `config_snapshot`; levels from `rubrics.levels` |
| `AuthGate.tsx` 69–73 | "@navgurukul.org only" text and check | membership check from the backend (`NOT_ENROLLED` screen) |
| `Header.tsx`, `Footer.tsx`, `public/ng-logo.png` | NG branding and social links | institution name, logo and links from `institutions` |
| `History.tsx` 83–160, `AllEvaluations.tsx` 138–150 | raw `fetch` with `?email=` | `apiFetch()` with token |

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Writing to the production DB by accident | Scripts open production read-only. Prompt 2's `DB_TARGET` forces a read-only session for prod outside `NODE_ENV=production`. |
| Prompt text drift changes scores | Rubrics and configs are stored as `JSON` (key order kept). `04-verify.js` byte-compares 147 prompt builds. Prompt 5 repeats the diff. |
| Test refresh wipes test evaluations | Documented. Config and memberships are upserted, not truncated. |
| Old clients (cached frontend) send `?email=` or the legacy `/evaluate` body | Both are accepted with a deprecation log until the follow-up PR. |
| Enabling auth breaks Amplify-deployed users mid-rollout | Deploy backend and frontend together (Prompt 8 rollout order). The old paths stay accepted. |
| Old rows with renamed phase/video names | Shown as WARN. Mapped via `05-legacy-name-mapping.sql`, or left unlinked (legacy columns still render). |
| RDS isn't reachable from Claude's sandbox | DB-touching commands run on Sachin's Mac. Code is tested against a local Postgres simulation. |
