# YouTube Video Feedback AI Instructions

## Project Overview
Full-stack YouTube video analysis platform that evaluates educational content (concept explanations and project walkthroughs) using Google Gemini AI. Built for assessing student-created web development videos (HTML/CSS learning phases).

**Tech Stack:** React + TypeScript (Vite), Express backend, PostgreSQL, Supabase Auth, Gemini 2.5 Flash API, shadcn/ui + Tailwind, Framer Motion

## Architecture

### Frontend (Port 3000)
- **Entry:** `src/main.tsx` → `App.tsx` (React Router setup)
- **Routes:** Index → VideoAnalyzer → AnalysisResults → History
- **Core Pages:**
  - `VideoAnalyzer.tsx`: Main evaluation form with video type (concept/project), project phase (Phase1=HTML-only, Phase2=CSS), page selection, and video URL input
  - `AnalysisResults.tsx`: Displays dual evaluations for concept videos (accuracy + ability-to-explain rubric) or rubric-based scores for project videos
  - `History.tsx`: User evaluation history from PostgreSQL

### Backend (Port 3001)
- **File:** `server/index.js` (ES modules)
- **Endpoints:**
  - `POST /evaluate`: Calls Gemini API with video URL, rubric, and prompts; returns JSON evaluation
  - `POST /store-evaluation`: Saves to PostgreSQL (`tbl_ailabs_ytfeedback_project_evaluation` or `tbl_ailabs_ytfeedback_concept_evaluations`)
- **Connection:** Uses `pg` Pool for PostgreSQL with RLS policies based on user email

### Database Schema
**Two evaluation tables:**
1. **Project evaluations** (`tbl_ailabs_ytfeedback_project_evaluation`): Stores project explanation evaluations with JSON results
2. **Concept evaluations** (`tbl_ailabs_ytfeedback_concept_evaluations`): Stores concept accuracy (INT 0/1) + ability-to-explain level (Beginner/Intermediate/Advanced/Expert)

## Critical Workflows

### Running the Application
```bash
# Terminal 1: Backend API
npm run start:api

# Terminal 2: Frontend dev server
npm run dev

# Or run both together:
npm start
```

**Important:** Vite proxy forwards `/evaluate` and `/store-evaluation` to `localhost:3001` in development (see `vite.config.ts`).

### Environment Variables
Required in `.env` (not committed):
```
# Gemini AI
GEMINI_API_KEY=AIza...        # API key format
VITE_GEMINI_API_KEY=AIza...   # Fallback for frontend

# Supabase Auth
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_KEY=...

# PostgreSQL (direct connection, not Supabase)
PG_HOST=...
PG_PORT=5432
PG_USER=...
PG_PASSWORD=...
PG_DATABASE=...
PG_SSL=true
```

### Authentication Flow
1. **Guard:** `AuthGate.tsx` wraps protected routes, forces Google OAuth via Supabase
2. **Implementation:** Uses `supabase.auth.signInWithOAuth({ provider: "google" })`
3. **Session:** Stored in localStorage, auto-refresh enabled in `src/integrations/supabase/client.ts`
4. **User ID:** Retrieved via `supabase.auth.getUser()` for database operations

### Evaluation Flow (Concept Videos)
1. User selects: Video Type=Concept, Project=Phase1/Phase2, Page (e.g., "Home Page"), YouTube URL
2. `VideoAnalyzer.tsx` generates two prompts:
   - **Accuracy check:** "Is explanation >80% accurate?" → Returns `{concept_explanation_accuracy: "Yes"/"No", concept_explanation_feedback: "..."}`
   - **Ability to explain:** Uses `abilityToExplainRubric` (4 levels) → Returns `{ability_to_explain_evaluation: "Beginner|Intermediate|Advanced|Expert", ability_to_explain_feedback: "..."}`
3. Both responses sent to `/store-evaluation` → Saved in `tbl_ailabs_ytfeedback_concept_evaluations`
4. Navigate to `AnalysisResults.tsx` with combined results

### Evaluation Flow (Project Videos)
1. User selects: Video Type=Project, Project=Phase1 (HTML rubric) or Phase2 (CSS rubric), YouTube URL
2. `VideoAnalyzer.tsx` calls `/evaluate` with rubric (arrays of criteria with weightings)
3. Gemini returns structured JSON matching rubric parameters
4. Saved to `tbl_ailabs_ytfeedback_project_evaluation` with `project_explanation_evaluationjson`
5. Results page shows criteria breakdown with grades

## Project-Specific Conventions

### Video Details Generation
`VideoAnalyzer.tsx` contains hardcoded page details for each `${projectType}-${pageName}` combination (e.g., "Phase1-Home Page" includes specific HTML tag questions). When adding new pages, update the switch statement in `getVideoDetails()`.

### Rubric Structure
- **HTML Project Rubric** (`htmlProjectRubric` in VideoAnalyzer): 3 parameters (Problem Understanding 40%, Conceptual Clarity 40%, Communication 20%), 4 levels (Beginner/Intermediate/Advanced/Expert)
- **CSS Project Rubric** (`cssProjectRubric`): Same structure, different criteria (box model, Flexbox/Grid, design choices)
- **Ability to Explain Rubric** (`abilityToExplainRubric`): 4 levels with Feynman technique markers (first principles, analogies, audience adaptation)

### Gemini API Integration
**Key details in `server/index.js`:**
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- Auth: API key in query string (`?key=...`) or Bearer token header
- Request body includes video URL in `file_data.file_uri` (YouTube URL directly, not download)
- Response format: `json.candidates[0].content.parts[0].text` contains JSON string
- Error handling: Status codes 400/401/403/429/500/503 mapped to user-friendly messages
- JSON repair function: Handles truncated responses by closing braces/quotes

### Component Patterns
- **Animations:** All pages use `framer-motion` with `MotionWrapper`, `AnimatedHeading`, `AnimatedIntroText`, and `CelebrationEffect`
- **UI Components:** shadcn/ui primitives in `src/components/ui/` (Button, Card, Input, Select, etc.)
- **Styling:** Tailwind with custom CSS variables for theme colors (see `src/index.css` HSL vars)
- **brutal shadow:** Custom design style (thick borders, bold shadows) defined in Tailwind config

### State Management
- **React Router state:** Evaluation results passed via `navigate('/analysis-results', { state: { ... } })` to avoid prop drilling
- **Toast notifications:** Global `useToast` hook from shadcn/ui (see `src/hooks/use-toast.ts`)
- **No global state library:** React Context used minimally; rely on URL params (`?id=...`) and route state

## Common Development Tasks

### Adding a New Page Type
1. Add page name to `pageOptions` array in `VideoAnalyzer.tsx`
2. Add case to `getVideoDetails()` switch with evaluation criteria
3. Update database if new fields needed (migration in `supabase/migrations/`)

### Modifying Rubrics
**Location:** `VideoAnalyzer.tsx` (constants `htmlProjectRubric`, `cssProjectRubric`, `abilityToExplainRubric`)
**Format:** Array of objects with `" - Criteria"`, `"Weightage (%)"`, and level descriptions

### Debugging Gemini API Failures
1. Check `server/index.js` console for detailed error logs (includes status codes and raw responses)
2. Common issues: Invalid video URL, quota exceeded (429), missing API key
3. JSON parsing fallback: Extracts from markdown code blocks (```json```) or finds first `{...}` match

### Database Queries
**User's evaluations:** Filter by email using RLS policies (auto-applied via Supabase JWT)
**Direct PostgreSQL:** Use `pgPool.query()` in `server/index.js` (avoid Supabase SDK for backend queries)

## Integration Points

### Supabase
- **Purpose:** OAuth only (Google login)
- **Not used for:** Database queries (PostgreSQL accessed directly)
- **Config:** `src/integrations/supabase/client.ts` with auto-refresh settings

### PostgreSQL
- **Direct connection:** Via `pg` library with connection pool
- **Migrations:** Two sources—`supabase/migrations/` (Supabase CLI) and `server/migrations/` (manual SQL)
- **Schema:** Separate tables for concept vs. project evaluations, indexed on email and created_at

### External APIs
- **Gemini AI:** Only external dependency for evaluation logic
- **YouTube:** URLs passed directly to Gemini (no YouTube Data API calls)

## Testing & Debugging
- **No automated tests:** Manual testing via browser
- **API testing:** Use curl/Postman against `localhost:3001/evaluate`
- **Auth debugging:** Check localStorage for Supabase session tokens

## Deployment Notes
- **Frontend:** Static build via `npm run build` (Vite outputs to `dist/`)
- **Backend:** Node.js server needs `server/index.js` running
- **Environment:** Amplify config in `amplify.yml` (separate frontend/backend phases)
- **Database migrations:** Run SQL files in `supabase/migrations/` manually or via Supabase CLI

## Important Gotchas
1. **Two evaluation flows:** Concept videos require two sequential API calls (accuracy + ability); project videos one call
2. **PostgreSQL vs Supabase:** Backend uses raw PostgreSQL connection, not Supabase SDK
3. **Vite proxy:** In dev, frontend proxies API calls; in prod, ensure backend URL configured via `VITE_API_URL` and `VITE_EVAL_API_URL` env vars
4. **JSON truncation:** Gemini sometimes returns incomplete JSON; `repairJSON()` function attempts automatic fixes
5. **Phase terminology:** Phase1=HTML-only projects, Phase2=CSS-styled projects (not app deployment phases)
