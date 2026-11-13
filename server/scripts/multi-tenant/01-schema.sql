-- =====================================================================
-- Multi-tenant configuration schema  (TEST database only)
-- Idempotent: safe to run more than once.
-- The legacy evaluation tables are created by 03-copy-from-prod.js, which
-- mirrors their exact column definitions from production.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid() on PG < 13

-- An organisation using the platform (Navgurukul, an engineering college, an MBA college...)
CREATE TABLE IF NOT EXISTS institutions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  slug                      TEXT NOT NULL UNIQUE,
  type                      TEXT NOT NULL DEFAULT 'other'
                            CHECK (type IN ('school','college','university','bootcamp','ngo','other')),
  allowed_email_domains     TEXT[] NOT NULL DEFAULT '{}',   -- auto-join as student
  logo_url                  TEXT,
  gemini_api_key_encrypted  TEXT,                            -- AES-256-GCM, never returned by API
  settings                  JSONB NOT NULL DEFAULT '{}',
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A branch / course / batch inside an institution ("School of Programming", "MBA 2026")
CREATE TABLE IF NOT EXISTS programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  sort_order      INT  NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, name)
);

-- Who can do what. super_admin rows have institution_id NULL.
CREATE TABLE IF NOT EXISTS user_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL CHECK (email = lower(email)),
  institution_id  UUID REFERENCES institutions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('super_admin','institution_admin','evaluator','student')),
  program_id      UUID REFERENCES programs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((role = 'super_admin') = (institution_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_membership
  ON user_memberships (email, COALESCE(institution_id, '00000000-0000-0000-0000-000000000000'::uuid), role);
CREATE INDEX IF NOT EXISTS idx_membership_institution ON user_memberships (institution_id, role);

-- Ordered phases / modules / units inside a program
CREATE TABLE IF NOT EXISTS phases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  sort_order      INT  NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, name)
);

-- Rubrics are versioned: an edit inserts version+1, old rows stay for past evaluations.
CREATE TABLE IF NOT EXISTS rubrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  rubric_type     TEXT NOT NULL CHECK (rubric_type IN ('project','ability_to_explain','generic')),
  levels          JSONB NOT NULL DEFAULT '[]',   -- e.g. ["Beginner (1)", ..., "Expert (4)"]
  criteria        JSON  NOT NULL,                -- JSON (not JSONB): keeps key order, so the LLM sees the exact same text
  version         INT  NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, name, version)
);

-- Prompt templates, versioned. institution_id NULL = global default new institutions inherit.
CREATE TABLE IF NOT EXISTS prompt_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     UUID REFERENCES institutions(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('accuracy','ability_to_explain','project','custom')),
  name               TEXT NOT NULL,
  prompt_text        TEXT NOT NULL,
  generation_config  JSON  NOT NULL,             -- temperature, seed, responseSchema... (JSON keeps key order)
  version            INT  NOT NULL DEFAULT 1,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_template
  ON prompt_templates (COALESCE(institution_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, name, version);

-- A video students must record for a phase, with its expected content and grading setup
CREATE TABLE IF NOT EXISTS video_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id             UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  video_type           TEXT NOT NULL CHECK (video_type IN ('concept','project')),
  title                TEXT NOT NULL,
  description          TEXT,
  what_to_cover        TEXT,
  questions_to_answer  JSONB NOT NULL DEFAULT '[]',   -- concept videos
  key_topics           JSONB NOT NULL DEFAULT '[]',   -- project videos
  rubric_id            UUID REFERENCES rubrics(id),           -- project rubric
  ability_rubric_id    UUID REFERENCES rubrics(id),           -- concept: ability-to-explain
  accuracy_prompt_id   UUID REFERENCES prompt_templates(id),
  ability_prompt_id    UUID REFERENCES prompt_templates(id),
  project_prompt_id    UUID REFERENCES prompt_templates(id),
  sort_order           INT  NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phase_id, video_type, title)
);
CREATE INDEX IF NOT EXISTS idx_video_assignments_phase ON video_assignments (phase_id, video_type, sort_order);

-- JSONB re-orders object keys, which would change the rubric text sent to Gemini.
-- Make sure these columns are plain JSON even if an earlier run created them as JSONB.
ALTER TABLE rubrics          ALTER COLUMN criteria          TYPE JSON USING criteria::text::json;
ALTER TABLE prompt_templates ALTER COLUMN generation_config TYPE JSON USING generation_config::text::json;
