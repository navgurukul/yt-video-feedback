-- =====================================================================
-- 07: Admin API support (TEST database only). Re-runnable.
-- =====================================================================

-- Who changed what in the admin / super-admin APIs
CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGSERIAL PRIMARY KEY,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  actor_email     TEXT NOT NULL,
  action          TEXT NOT NULL,          -- create | update | delete | reorder | new_version | ...
  entity          TEXT NOT NULL,          -- program | phase | video | rubric | prompt | user | settings | institution
  entity_id       TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_institution ON audit_log (institution_id, created_at DESC);

-- Lookups used by the admin API
CREATE INDEX IF NOT EXISTS idx_rubrics_institution_active ON rubrics (institution_id, name, version DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_institution_active ON prompt_templates (institution_id, kind, version DESC);
