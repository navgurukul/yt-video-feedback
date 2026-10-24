# API Reference (multi-tenant)

All endpoints except `/health` need `Authorization: Bearer <Supabase access token>`.
- **Optional header:** `X-Institution-Id: <uuid>`. It picks the active institution for a user who belongs to several, and is ignored if the user isn't a member there. A super admin may use any institution.
- **Errors:** `{ error, details? }`.
- **401:** `UNAUTHENTICATED`.
- **403:** `NOT_ENROLLED` (no institution) or `FORBIDDEN` (role too low).
- **400:** validation failed; `details` lists the reasons.
- **409:** duplicate name or slug.

Roles, lowest to highest: `student` < `evaluator` < `institution_admin` < `super_admin`.

## Everyone (student+)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Public. |
| GET | `/api/me` | `{ email, isSuperAdmin, role, memberships[], activeInstitution }` |
| GET | `/api/config` | Active institution's syllabus: `institution`, `programs[].phases[].videos[]` (active only, ordered). Cached 60 s and refreshed on every admin change. |
| GET | `/api/rubrics/:id` | A rubric of your institution (to render results). |
| POST | `/evaluate` | **New:** `{ videoUrl, videoAssignmentId, evaluationKind: accuracy\|ability_to_explain\|project, apiKey?, model? }` or `{ videoUrl, evaluationKind: "custom", customPrompt, customContext? }`. The server loads the prompt and rubric from the DB; the response adds `evaluation_config` (video, prompt and rubric ids + versions). **Legacy** bodies with `promptbegining` still work but log a deprecation. Gemini key: institution key → `apiKey` → server env. |
| POST | `/store-evaluation` | Identity comes from the token. Send `videoAssignmentId` to link the exact video; otherwise it's resolved from `selectedPhase`/`selectedVideoTitle`. `config_snapshot` records the rubric and prompt versions used. |
| GET | `/concept-history`, `/project-history`, `/custom-history` | Your own rows in the active institution. The legacy `?email=` is ignored. |
| GET / DELETE | `/{concept,project,custom}-evaluation/:id` | Read: the owner, or an evaluator+ of the same institution. Delete: the owner, or an institution_admin+. |

## Evaluator+

| Method | Path | Notes |
|---|---|---|
| GET | `/all-evaluations?page&limit&type&search&sortBy&sortOrder` | Your institution only. A super admin can add `&institutionId=`. |
| GET | `/manual-eval-videos[?id=]` (also `/api/…`) | Excludes the emails in the institution setting `manualEvalExcludedEmails`. |
| POST | `/manual-evaluation` (also `/api/…`) | `{ projectEvaluationId, evaluationJson, overallRating?, overallComments?, … }`. The evaluator is taken from the token. |

## Institution admin (`/api/admin/*`)

**Deleting** a program, phase or video only deactivates it, so past evaluations keep their links.
**Editing** a rubric or prompt creates a new version, and videos using the old version move to the new one. Past evaluations keep the version they were graded with.

| Method | Path | Body / notes |
|---|---|---|
| GET | `/api/admin/config` | Same tree as `/api/config`, including inactive items. |
| POST | `/api/admin/programs` | `{ name, description?, sortOrder?, isActive? }` |
| PATCH / DELETE | `/api/admin/programs/:id` | Partial body / deactivate. |
| POST | `/api/admin/phases` | `{ programId, name, description?, sortOrder? }` |
| PATCH / DELETE | `/api/admin/phases/:id` | |
| POST | `/api/admin/programs/:id/phases/reorder` | `{ ids: [phaseId, …] }` |
| POST | `/api/admin/videos` | See the example below. |
| PATCH / DELETE | `/api/admin/videos/:id` | |
| POST | `/api/admin/phases/:id/videos/reorder` | `{ ids: [videoId, …] }` |
| GET | `/api/admin/rubrics` | Latest version of each rubric, plus `versions` count. |
| GET | `/api/admin/rubrics/:id`, `/api/admin/rubrics/:id/versions` | |
| POST | `/api/admin/rubrics` | See the example below. |
| POST | `/api/admin/rubrics/:id/versions` | `{ criteria, levels? }`. Returns `version`, `videosUpdated`, `warnings`. "Restore" = post an old version's criteria. |
| GET | `/api/admin/prompts` | Own prompts plus global defaults (`isGlobalDefault: true`, read-only). |
| GET | `/api/admin/prompts/:id`, `/api/admin/prompts/:id/versions` | |
| POST | `/api/admin/prompts` | `{ kind: accuracy\|ability_to_explain\|project\|custom, name, promptText, generationConfig }` |
| POST | `/api/admin/prompts/:id/versions` | `{ promptText, generationConfig }` |
| POST | `/api/admin/prompts/:id/test` | `{ videoUrl, videoAssignmentId, apiKey?, model? }`. A dry run with Gemini; nothing is stored. Returns `promptText`, `text`, `parsed`, `usage`, `keySource`. |
| GET | `/api/admin/users` | Members with their evaluation counts. |
| POST | `/api/admin/users` | `{ email, role: student\|evaluator\|institution_admin, programId? }` |
| PATCH / DELETE | `/api/admin/users/:id` | You can't remove your own admin role. |
| GET / PUT | `/api/admin/settings` | See the example below. |
| GET | `/api/admin/stats` | Totals, active students (30 days), LLM calls and tokens (30 days), evaluations per phase. |

**Example: create a video** (`POST /api/admin/videos`)

```json
{ "phaseId": "…", "videoType": "project", "title": "Final Pitch",
  "whatToCover": "…", "keyTopics": ["Market", "Pricing"],
  "rubricId": "…", "projectPromptId": "…" }
```
- Concept videos use `questionsToAnswer`, `abilityRubricId`, `accuracyPromptId` and `abilityPromptId` instead.
- Linked rubrics and prompts must belong to the institution. Prompts may also be global defaults.

**Example: create a rubric** (`POST /api/admin/rubrics`)

```json
{ "name": "Pitch Rubric", "rubricType": "project",
  "levels": ["Beginner (1)", "Intermediate (2)", "Advanced (3)", "Expert (4)"],
  "criteria": [{ "Parameter": "Clarity", "Weightage (%)": 50,
                 "Beginner (1)": "…", "Intermediate (2)": "…", "Advanced (3)": "…", "Expert (4)": "…",
                 "Checklist": ["…"] }] }
```
- Every criterion needs a name, a weight from 1 to 100, and a description for each level.
- Weights that don't total 100% return a **warning**, not an error. Navgurukul's own rubrics total 30–60%.

**Prompt validation:** the `responseSchema` must contain the fields the results page reads:

| Kind | Required fields |
|---|---|
| accuracy | `Accuracy Level` |
| ability_to_explain | `Ability to explain` |
| project | `video_validation`, `topic_coverage`, `parameters` |
| custom | `evaluation_result` |

**Example: update settings** (`PUT /api/admin/settings`)

```json
{ "name": "…", "logoUrl": "…", "allowedEmailDomains": ["college.edu"],
  "geminiApiKey": "…", "manualEvalExcludedEmails": ["staff@college.edu"] }
```
- The Gemini key is encrypted with AES-256-GCM using `ENCRYPTION_KEY`. Only `••••last4` is ever returned.
- Send `"geminiApiKey": null` to remove the key.

## Super admin (`/api/super/*`)

| Method | Path | Body / notes |
|---|---|---|
| GET | `/api/super/institutions` | Every institution with students, admins, programs, evaluations and tokens (30 days). |
| POST | `/api/super/institutions` | See the example below. Creates the institution and its first `institution_admin`. |
| PATCH | `/api/super/institutions/:id` | `{ name?, type?, status: active\|suspended, allowedEmailDomains?, logoUrl? }`. A suspended institution's users get `NOT_ENROLLED`. |
| POST | `/api/super/institutions/:id/users` | `{ email, role }`, e.g. to add another admin. |
| GET | `/api/super/stats` | Platform totals plus per-institution rows. |

**Example: create an institution** (`POST /api/super/institutions`)

```json
{ "name": "Demo MBA College", "slug": "demo-mba", "type": "college",
  "allowedEmailDomains": ["demo-mba.edu"], "adminEmail": "dean@demo-mba.edu",
  "cloneFromInstitutionId": "<optional uuid>" }
```
`cloneFromInstitutionId` copies that institution's active programs, phases, videos, rubrics and prompts.

## Environment (server/.env)

| Variable | Purpose |
|---|---|
| `DB_TARGET` | `test` \| `prod` \| `prod-readonly` (see `server/db.js`) |
| `TEST_PG_*` / `PG_*` | Database connections. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Verifying logins. Falls back to `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from the root `.env`. |
| `ENCRYPTION_KEY` | Encrypts institution Gemini keys. Any random string of 32+ characters; keep it stable. |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins. |
| `GEMINI_API_KEY` | Optional server-wide fallback key. |
