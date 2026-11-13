-- ==================================================================================
-- Dashboard component: Phasewise Student Project Explanation Analysis
-- Database: TEST (test_ghar_central_db). Columns: email, phase_name, source, evaluated_at, criteria, level, What you did well?, What could you do better?, Suggestion for improvement?
-- Every rubric parameter of each student's LATEST YT project-explanation ("YT Tool") and Project Analyzer
-- ("Athena") evaluation per phase, with level and feedback (time filter: evaluated_at).
-- Same rules as production view v_ailabs_phasewise_student_project_explanation_analysis.
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
yt_project AS (           -- YT project-explanation evaluations; phase = the phase whose name the
                          -- video was saved under (same rule as production)
  SELECT e.id, LOWER(TRIM(e.email)) AS email, np.phase_no, np.phase_name, e.created_at,
         e.project_explanation_evaluationjson AS evaluation_json,
         (e.project_explanation_evaluationjson IS NOT NULL
          AND TRIM(e.project_explanation_evaluationjson) <> '') AS has_evaluation
    FROM public.tbl_ailabs_ytfeedback_project_evaluation e
    JOIN scope s ON s.institution_id = e.institution_id
    JOIN nav_phases np ON LOWER(TRIM(np.phase_name)) = LOWER(TRIM(e.project_name))
    -- To also count videos saved under an OLD phase name (production does not), use the
    -- phase link instead:   JOIN nav_phases np ON np.phase_uuid = e.phase_id
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
latest_yt_eval AS (       -- latest YT project evaluation with a result, per student and phase
  SELECT DISTINCT ON (email, phase_no) email, phase_no, created_at AS evaluated_at, evaluation_json
    FROM yt_project
   WHERE has_evaluation
   ORDER BY email, phase_no, created_at DESC
),
latest_pa_eval AS (       -- latest completed Project Analyzer evaluation, per student and phase
  SELECT DISTINCT ON (email, phase_no) email, phase_no, evaluated_at, final_feedback
    FROM pa_project
   WHERE status = 'completed' AND final_feedback IS NOT NULL
   ORDER BY email, phase_no, evaluated_at DESC NULLS LAST
),
yt_rows AS (              -- as production: every phase, its latest evaluations, one row per parameter
  SELECT l.email, ph.phase_no, ph.phase_name, 'YT Tool'::text AS source, l.evaluated_at,
         prm.value ->> 'name' AS criteria, prm.value ->> 'level' AS level,
         (SELECT string_agg(item, chr(10))
          FROM jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(prm.value -> 'feedback' -> 'What you did well.') = 'array' THEN prm.value -> 'feedback' -> 'What you did well.' ELSE '[]'::jsonb END) item) AS did_well,
         (SELECT string_agg(item, chr(10))
          FROM jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(prm.value -> 'feedback' -> 'What could you do better.') = 'array' THEN prm.value -> 'feedback' -> 'What could you do better.' ELSE '[]'::jsonb END) item) AS could_be_better,
         (SELECT string_agg(item, chr(10))
          FROM jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(prm.value -> 'feedback' -> 'Suggestion for project improvement.') = 'array' THEN prm.value -> 'feedback' -> 'Suggestion for project improvement.' ELSE '[]'::jsonb END) item) AS suggestions
    FROM nav_phases ph
    LEFT JOIN latest_yt_eval l ON l.phase_no = ph.phase_no
    LEFT JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(l.evaluation_json::jsonb -> 'parameters') = 'array'
           THEN l.evaluation_json::jsonb -> 'parameters' ELSE '[]'::jsonb END) prm ON TRUE
),
pa_rows AS (
  SELECT l.email, ph.phase_no, ph.phase_name, 'Athena'::text AS source, l.evaluated_at,
         c.value ->> 'parameter' AS criteria, c.value ->> 'assignedLevel' AS level,
         (SELECT string_agg(item, chr(10))
          FROM jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(c.value -> 'detailedFeedback' -> 'wellDone') = 'array' THEN c.value -> 'detailedFeedback' -> 'wellDone' ELSE '[]'::jsonb END) item) AS did_well,
         (SELECT string_agg(item, chr(10))
          FROM jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(c.value -> 'detailedFeedback' -> 'couldBeBetter') = 'array' THEN c.value -> 'detailedFeedback' -> 'couldBeBetter' ELSE '[]'::jsonb END) item) AS could_be_better,
         (SELECT string_agg(item, chr(10))
          FROM jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(c.value -> 'detailedFeedback' -> 'suggestions') = 'array' THEN c.value -> 'detailedFeedback' -> 'suggestions' ELSE '[]'::jsonb END) item) AS suggestions
    FROM nav_phases ph
    JOIN latest_pa_eval l ON l.phase_no = ph.phase_no
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(l.final_feedback -> 'criterionWiseEvaluation') = 'array'
           THEN l.final_feedback -> 'criterionWiseEvaluation' ELSE '[]'::jsonb END) c
)
SELECT email,
       phase_name,
       source,
       evaluated_at,
       criteria,
       level,
       did_well        AS "What you did well?",
       could_be_better AS "What could you do better?",
       suggestions     AS "Suggestion for improvement?"
  FROM (SELECT * FROM yt_rows UNION ALL SELECT * FROM pa_rows) all_feedback
 ORDER BY email, phase_no, source, criteria
