-- ==================================================================================
-- Dashboard component: Phasewise Student Project Explanation Analysis
-- Database: TEST (test_ghar_central_db). Columns: evaluated_at, email, phase_name, source, criteria, level, What you did well?, What could you do better?, Suggestion for improvement?
-- Every rubric parameter of every YT project-explanation and Project Analyzer evaluation, with the
-- level and feedback (time filter: evaluated_at). Replaces production view
-- v_ailabs_phasewise_student_project_explanation_analysis.
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
yt_project AS (           -- YT project-explanation evaluations, matched to a phase by their phase link
  SELECT e.id, LOWER(TRIM(e.email)) AS email, np.phase_no, np.phase_name, e.created_at,
         e.project_explanation_evaluationjson AS evaluation_json,
         (e.project_explanation_evaluationjson IS NOT NULL
          AND TRIM(e.project_explanation_evaluationjson) <> '') AS has_evaluation
    FROM public.tbl_ailabs_ytfeedback_project_evaluation e
    JOIN scope s ON s.institution_id = e.institution_id
    LEFT JOIN public.legacy_phase_name_map m           -- rows saved under an old phase name
           ON e.phase_id IS NULL AND m.old_name = e.project_name
    JOIN nav_phases np
      ON np.phase_uuid = COALESCE(e.phase_id, m.phase_id)
      OR (e.phase_id IS NULL AND m.phase_id IS NULL
          AND LOWER(TRIM(np.phase_name)) = LOWER(TRIM(e.project_name)))
),
pa_project AS (           -- Project Analyzer projects, matched to a phase through their phase spec
  SELECT pp."_id" AS project_id, LOWER(TRIM(pu.email)) AS email, np.phase_no, np.phase_name,
         LOWER(TRIM(COALESCE(pp.status, ''))) AS status,
         pp."finalFeedback"::jsonb AS final_feedback,
         COALESCE(pp."updatedAt", pp."createdAt") AT TIME ZONE 'UTC' AS evaluated_at   -- *_af times are UTC
    FROM public.tbl_ailabs_projectanalyzer_projects_af pp
    JOIN scope s ON s.institution_id = pp.institution_id
    JOIN public.tbl_ailabs_projectanalyzer_users_af pu ON pu."_id" = pp."userId"
    LEFT JOIN public.pa_phase_specs ps ON ps.id = pp.pa_phase_spec_id
    JOIN nav_phases np
      ON np.phase_uuid = ps.phase_id
      OR (ps.id IS NULL AND pp.phase ~ '^phase[0-9]+$'
          AND np.phase_no = substring(pp.phase FROM 6)::int)
),
parameter_levels AS (
  SELECT 'YT Project Explanation'::text AS source, y.email, y.phase_name, y.created_at AS evaluated_at,
         prm.value ->> 'name' AS criteria, prm.value ->> 'level' AS level, prm.value -> 'feedback' AS fb,
         NULL::jsonb AS pa_fb
    FROM yt_project y
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(y.evaluation_json::jsonb -> 'parameters') = 'array'
           THEN y.evaluation_json::jsonb -> 'parameters' ELSE '[]'::jsonb END) prm
   WHERE y.has_evaluation AND y.evaluation_json ~ '^\s*\{.*\}\s*$'
  UNION ALL
  SELECT 'Project Analyzer', p.email, p.phase_name, p.evaluated_at,
         c.value ->> 'parameter', c.value ->> 'assignedLevel', NULL::jsonb, c.value -> 'detailedFeedback'
    FROM pa_project p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.final_feedback -> 'criterionWiseEvaluation') = 'array'
           THEN p.final_feedback -> 'criterionWiseEvaluation' ELSE '[]'::jsonb END) c
   WHERE p.status = 'completed'
)
SELECT evaluated_at,
       email,
       phase_name,
       source,
       criteria,
       level,
       COALESCE((SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(fb -> 'What you did well.', fb -> 'What you did well?', fb -> 'What could you do well?'))
                   WHEN 'array' THEN COALESCE(fb -> 'What you did well.', fb -> 'What you did well?', fb -> 'What could you do well?')
                   ELSE jsonb_build_array(COALESCE(fb -> 'What you did well.', fb -> 'What you did well?', fb -> 'What could you do well?')) END) item),
                (SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(pa_fb -> 'wellDone'))
                   WHEN 'array' THEN COALESCE(pa_fb -> 'wellDone')
                   ELSE jsonb_build_array(COALESCE(pa_fb -> 'wellDone')) END) item))      AS "What you did well?",
       COALESCE((SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(fb -> 'What could you do better.', fb -> 'What could you do better?'))
                   WHEN 'array' THEN COALESCE(fb -> 'What could you do better.', fb -> 'What could you do better?')
                   ELSE jsonb_build_array(COALESCE(fb -> 'What could you do better.', fb -> 'What could you do better?')) END) item),
                (SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(pa_fb -> 'couldBeBetter'))
                   WHEN 'array' THEN COALESCE(pa_fb -> 'couldBeBetter')
                   ELSE jsonb_build_array(COALESCE(pa_fb -> 'couldBeBetter')) END) item)) AS "What could you do better?",
       COALESCE((SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(fb -> 'Suggestion for project improvement.', fb -> 'Suggestion for improvement?', fb -> 'Suggestion for improvement.'))
                   WHEN 'array' THEN COALESCE(fb -> 'Suggestion for project improvement.', fb -> 'Suggestion for improvement?', fb -> 'Suggestion for improvement.')
                   ELSE jsonb_build_array(COALESCE(fb -> 'Suggestion for project improvement.', fb -> 'Suggestion for improvement?', fb -> 'Suggestion for improvement.')) END) item),
                (SELECT string_agg('• ' || item, E'\n')
          FROM jsonb_array_elements_text(
                 CASE jsonb_typeof(COALESCE(pa_fb -> 'suggestions'))
                   WHEN 'array' THEN COALESCE(pa_fb -> 'suggestions')
                   ELSE jsonb_build_array(COALESCE(pa_fb -> 'suggestions')) END) item))   AS "Suggestion for improvement?"
  FROM parameter_levels
 ORDER BY evaluated_at DESC, email, criteria
