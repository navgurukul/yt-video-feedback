-- ==================================================================================
-- Dashboard component: Students Concept Explanation Analysis
-- Database: TEST (test_ghar_central_db). Columns: email, phase_name, video_number, video_title, ability_to_explain_evaluation, ability_to_explain_did_well, ability_to_explain_could_be_better, ability_to_explain_suggestion, accuracy_above_80, concept_explanation_did_well, concept_explanation_could_be_better, concept_explanation_suggestion, evaluated_at
-- Every concept-video evaluation with its feedback split into columns (time filter: evaluated_at).
-- Replaces production view v_ailabs_students_concept_explanationanalysis. Feedback stored as plain
-- text (older rows) is shown whole in the *_did_well columns.
-- ==================================================================================
WITH
scope AS (                -- Navgurukul / School of Programming in the multi-tenant tools
  SELECT i.id AS institution_id, p.id AS program_id
    FROM public.institutions i
    JOIN public.programs p ON p.institution_id = i.id
   WHERE i.slug = 'navgurukul' AND p.name = 'School of Programming'
),
nav_phases AS (           -- phase number = the "Phase N" in the phase name (sort order otherwise)
  SELECT ph.id AS phase_uuid,
         COALESCE((regexp_match(ph.name, '^\s*Phase\s+(\d+)', 'i'))[1]::int, ph.sort_order) AS phase_no,
         ph.name AS phase_name
    FROM public.phases ph
    JOIN scope s ON s.program_id = ph.program_id
   WHERE ph.is_active
),
concept_videos AS (       -- concept videos of each phase, numbered within the phase
  SELECT va.id AS video_uuid, np.phase_no, np.phase_name, va.title AS video_title,
         ROW_NUMBER() OVER (PARTITION BY va.phase_id ORDER BY va.sort_order, va.created_at, va.title) AS video_number
    FROM public.video_assignments va
    JOIN nav_phases np ON np.phase_uuid = va.phase_id
   WHERE va.video_type = 'concept' AND va.is_active
),
concept_evals AS (        -- concept-video evaluations, matched to their video by the video link
  SELECT ce.id, LOWER(TRIM(ce.email)) AS email, v.phase_no, v.phase_name,
         v.video_uuid, v.video_number, v.video_title,
         NULLIF(REGEXP_REPLACE(COALESCE(ce.concept_explanation_accuracy::text, ''), '[^0-9.]', '', 'g'), '')::numeric AS accuracy,
         ce.ability_to_explain_evaluation, ce.ability_to_explain_feedback, ce.concept_explanation_feedback,
         ce.created_at
    FROM public.tbl_ailabs_ytfeedback_concept_evaluations ce
    JOIN scope s ON s.institution_id = ce.institution_id
    LEFT JOIN LATERAL (                                 -- rows saved before the links existed:
      SELECT cv.video_uuid                              -- match the video title, as production
        FROM concept_videos cv
       WHERE ce.video_assignment_id IS NULL
         AND (LOWER(TRIM(ce.page_name)) = LOWER(TRIM(cv.video_title))
              OR LOWER(TRIM(ce.page_name)) = LOWER(TRIM(cv.video_title || ' - ' || cv.phase_name)))
       ORDER BY (LOWER(TRIM(cv.phase_name)) = LOWER(TRIM(ce.project_name))) DESC, cv.phase_no
       LIMIT 1) fb ON TRUE
    JOIN concept_videos v ON v.video_uuid = COALESCE(ce.video_assignment_id, fb.video_uuid)
),
parsed AS (               -- feedback is JSON text: {"What you did well.": [..], ...}
  SELECT c.*,
         CASE WHEN c.ability_to_explain_feedback  ~ '^\s*\{.*\}\s*$' THEN c.ability_to_explain_feedback::jsonb  END AS ability_json,
         CASE WHEN c.concept_explanation_feedback ~ '^\s*\{.*\}\s*$' THEN c.concept_explanation_feedback::jsonb END AS concept_json
    FROM concept_evals c
)
SELECT email,
       phase_name,
       video_number,
       video_title,
       ability_to_explain_evaluation,
       COALESCE((SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(ability_json -> 'What you did well.', ability_json -> 'What you did well?'))
                   WHEN 'array' THEN COALESCE(ability_json -> 'What you did well.', ability_json -> 'What you did well?')
                   ELSE jsonb_build_array(COALESCE(ability_json -> 'What you did well.', ability_json -> 'What you did well?')) END) item),
                CASE WHEN ability_json IS NULL THEN ability_to_explain_feedback END) AS ability_to_explain_did_well,
       (SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(ability_json -> 'What could you do better.', ability_json -> 'What could you do better?'))
                   WHEN 'array' THEN COALESCE(ability_json -> 'What could you do better.', ability_json -> 'What could you do better?')
                   ELSE jsonb_build_array(COALESCE(ability_json -> 'What could you do better.', ability_json -> 'What could you do better?')) END) item) AS ability_to_explain_could_be_better,
       (SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(ability_json -> 'Suggestion for improving explanation.', ability_json -> 'Suggestion for improvement.'))
                   WHEN 'array' THEN COALESCE(ability_json -> 'Suggestion for improving explanation.', ability_json -> 'Suggestion for improvement.')
                   ELSE jsonb_build_array(COALESCE(ability_json -> 'Suggestion for improving explanation.', ability_json -> 'Suggestion for improvement.')) END) item) AS ability_to_explain_suggestion,
       CASE WHEN accuracy IS NULL THEN NULL WHEN accuracy > 80 THEN 'Yes' ELSE 'No' END AS accuracy_above_80,
       COALESCE((SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(concept_json -> 'What you did well.', concept_json -> 'What you did well?'))
                   WHEN 'array' THEN COALESCE(concept_json -> 'What you did well.', concept_json -> 'What you did well?')
                   ELSE jsonb_build_array(COALESCE(concept_json -> 'What you did well.', concept_json -> 'What you did well?')) END) item),
                CASE WHEN concept_json IS NULL THEN concept_explanation_feedback END) AS concept_explanation_did_well,
       (SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(concept_json -> 'What could you do better.', concept_json -> 'What could you do better?'))
                   WHEN 'array' THEN COALESCE(concept_json -> 'What could you do better.', concept_json -> 'What could you do better?')
                   ELSE jsonb_build_array(COALESCE(concept_json -> 'What could you do better.', concept_json -> 'What could you do better?')) END) item) AS concept_explanation_could_be_better,
       (SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(concept_json -> 'Suggestion for technical accuracy improvement.', concept_json -> 'Suggestion for improvement.'))
                   WHEN 'array' THEN COALESCE(concept_json -> 'Suggestion for technical accuracy improvement.', concept_json -> 'Suggestion for improvement.')
                   ELSE jsonb_build_array(COALESCE(concept_json -> 'Suggestion for technical accuracy improvement.', concept_json -> 'Suggestion for improvement.')) END) item) AS concept_explanation_suggestion,
       created_at AS evaluated_at
  FROM parsed
 ORDER BY email, phase_no, video_number, created_at
