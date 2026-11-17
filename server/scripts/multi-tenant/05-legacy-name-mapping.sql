-- =====================================================================
-- 05: Link evaluations stored under OLD phase names (TEST database only)
--
-- Early evaluations were saved with earlier phase names, e.g.
--   "Phase 1: HTML Only — Student Profile & Course Portal"
-- while the current syllabus says
--   "Phase 1: Student Profile & Course Portal (HTML Only)".
-- The video titles themselves are unchanged. Rule: same "Phase N" number
-- (+ exact video title for concept videos) → current phase/video.
-- Rows with project_name NULL, or titles not in that phase, stay unlinked;
-- they still show in history through the legacy columns.
-- Re-runnable: it only touches rows where video_assignment_id IS NULL.
-- =====================================================================

CREATE TABLE IF NOT EXISTS legacy_phase_name_map (
  old_name    TEXT PRIMARY KEY,
  phase_id    UUID NOT NULL REFERENCES phases(id),
  rule        TEXT NOT NULL DEFAULT 'same phase number',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH ng AS (
  SELECT p.id AS program_id FROM programs p
  JOIN institutions i ON i.id = p.institution_id
  WHERE i.slug = 'navgurukul' AND p.name = 'School of Programming'
),
current_phases AS (
  SELECT ph.id, ph.name, substring(ph.name FROM '^Phase (\d+)') AS num
  FROM phases ph JOIN ng ON ph.program_id = ng.program_id
),
old_names AS (
  SELECT project_name AS old_name FROM tbl_ailabs_ytfeedback_concept_evaluations WHERE video_assignment_id IS NULL
  UNION
  SELECT project_name FROM tbl_ailabs_ytfeedback_project_evaluation WHERE video_assignment_id IS NULL
)
INSERT INTO legacy_phase_name_map (old_name, phase_id)
SELECT o.old_name, cp.id
FROM old_names o
JOIN current_phases cp ON cp.num = substring(o.old_name FROM '^Phase (\d+)')
WHERE o.old_name IS NOT NULL
  AND o.old_name NOT IN (SELECT name FROM current_phases)
ON CONFLICT (old_name) DO NOTHING;

-- Concept: old phase name → current phase, then exact title inside that phase
UPDATE tbl_ailabs_ytfeedback_concept_evaluations e SET
    program_id = ph.program_id, phase_id = ph.id, video_assignment_id = va.id,
    rubric_id = va.ability_rubric_id,
    prompt_template_ids = jsonb_build_object('accuracy', va.accuracy_prompt_id, 'ability_to_explain', va.ability_prompt_id),
    config_snapshot = jsonb_build_object('source', 'legacy-migration', 'rubric_version', 1, 'prompt_version', 1,
                                         'mapped_from_phase_name', e.project_name)
  FROM legacy_phase_name_map m
  JOIN phases ph ON ph.id = m.phase_id
  JOIN video_assignments va ON va.phase_id = ph.id AND va.video_type = 'concept'
 WHERE e.video_assignment_id IS NULL
   AND e.project_name = m.old_name
   AND va.title = e.page_name;

-- Project: old phase name → that phase's project video
UPDATE tbl_ailabs_ytfeedback_project_evaluation e SET
    program_id = ph.program_id, phase_id = ph.id, video_assignment_id = va.id, rubric_id = va.rubric_id,
    prompt_template_ids = jsonb_build_object('project', va.project_prompt_id),
    config_snapshot = jsonb_build_object('source', 'legacy-migration', 'rubric_version', 1, 'prompt_version', 1,
                                         'mapped_from_phase_name', e.project_name)
  FROM legacy_phase_name_map m
  JOIN phases ph ON ph.id = m.phase_id
  JOIN video_assignments va ON va.phase_id = ph.id AND va.video_type = 'project'
 WHERE e.video_assignment_id IS NULL
   AND e.project_name = m.old_name;
