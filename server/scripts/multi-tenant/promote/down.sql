-- =====================================================================
-- ROLLBACK of the multi-tenant promotion. Drops ONLY what promote.js added:
-- the tenant columns on the legacy tables and the new config tables.
-- Legacy data (evaluations, metrics, issues, failed requests) is untouched.
--
-- Run only if you need to go back AND the old (master) app is deployed again.
-- Evaluations made with the new app stay, but lose their institution/rubric links.
--   psql "<MAIN connection>" -f server/scripts/multi-tenant/promote/down.sql
-- =====================================================================
BEGIN;

ALTER TABLE IF EXISTS tbl_ailabs_ytfeedback_concept_evaluations
  DROP COLUMN IF EXISTS institution_id, DROP COLUMN IF EXISTS program_id, DROP COLUMN IF EXISTS phase_id,
  DROP COLUMN IF EXISTS video_assignment_id, DROP COLUMN IF EXISTS rubric_id,
  DROP COLUMN IF EXISTS prompt_template_ids, DROP COLUMN IF EXISTS config_snapshot;
ALTER TABLE IF EXISTS tbl_ailabs_ytfeedback_project_evaluation
  DROP COLUMN IF EXISTS institution_id, DROP COLUMN IF EXISTS program_id, DROP COLUMN IF EXISTS phase_id,
  DROP COLUMN IF EXISTS video_assignment_id, DROP COLUMN IF EXISTS rubric_id,
  DROP COLUMN IF EXISTS prompt_template_ids, DROP COLUMN IF EXISTS config_snapshot;
ALTER TABLE IF EXISTS tbl_ailabs_ytfeedback_custom_evaluations
  DROP COLUMN IF EXISTS institution_id, DROP COLUMN IF EXISTS program_id, DROP COLUMN IF EXISTS phase_id,
  DROP COLUMN IF EXISTS video_assignment_id, DROP COLUMN IF EXISTS rubric_id,
  DROP COLUMN IF EXISTS prompt_template_ids, DROP COLUMN IF EXISTS config_snapshot;
ALTER TABLE IF EXISTS tbl_manual_video_evaluations DROP COLUMN IF EXISTS institution_id;
ALTER TABLE IF EXISTS tbl_llm_api_calls            DROP COLUMN IF EXISTS institution_id;
ALTER TABLE IF EXISTS tbl_user_issues              DROP COLUMN IF EXISTS institution_id;
ALTER TABLE IF EXISTS tbl_failed_requests          DROP COLUMN IF EXISTS institution_id;

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS legacy_phase_name_map;
DROP TABLE IF EXISTS video_assignments;
DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS rubrics;
DROP TABLE IF EXISTS phases;
DROP TABLE IF EXISTS user_memberships;
DROP TABLE IF EXISTS programs;
DROP TABLE IF EXISTS institutions;

COMMIT;
