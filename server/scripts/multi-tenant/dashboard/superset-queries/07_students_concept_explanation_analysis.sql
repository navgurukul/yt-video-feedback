-- ==================================================================================
-- Dashboard component: Students Concept Explanation Analysis
-- Database: TEST (test_ghar_central_db). Columns: email, phase_name, video_number, video_title, ability_to_explain_evaluation, ability_to_explain_did_well, ability_to_explain_could_be_better, ability_to_explain_suggestion, accuracy_above_80, concept_explanation_did_well, concept_explanation_could_be_better, concept_explanation_suggestion, evaluated_at
-- Latest evaluation of every concept video per student, with the feedback split into columns
-- (time filter: evaluated_at). Same rules as production view v_ailabs_students_concept_explanationanalysis,
-- including its LIMIT 1000 (first 1000 rows by email, phase, video).
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
concept_videos AS (       -- concept videos of each phase; numbered as in the original syllabus table
                          -- (tbl_ailabls_ytfeedback_phasevideos, as production), videos added later after them
  SELECT x.video_uuid, x.phase_no, x.phase_name, x.video_title,
         COALESCE(x.legacy_number,
                  COALESCE(MAX(x.legacy_number) OVER (PARTITION BY x.phase_no), 0)
                  + ROW_NUMBER() OVER (PARTITION BY x.phase_no, (x.legacy_number IS NULL)
                                       ORDER BY x.sort_order, x.video_title)) AS video_number
    FROM (SELECT va.id AS video_uuid, np.phase_no, np.phase_name, va.title AS video_title, va.sort_order,
                 lv.legacy_number
            FROM public.video_assignments va
            JOIN nav_phases np ON np.phase_uuid = va.phase_id
            LEFT JOIN (SELECT phase_id AS phase_no, LOWER(TRIM(video_title)) AS title_key, MIN(n) AS legacy_number
                         FROM (SELECT pv.phase_id, pv.video_title,
                                      ROW_NUMBER() OVER (PARTITION BY pv.phase_id ORDER BY pv.id) AS n
                                 FROM public.tbl_ailabls_ytfeedback_phasevideos pv) z
                        GROUP BY phase_id, LOWER(TRIM(video_title))) lv
                   ON lv.phase_no = np.phase_no AND lv.title_key = LOWER(TRIM(va.title))
           WHERE va.video_type = 'concept' AND va.is_active) x
),
concept_matches AS (      -- every concept-video evaluation x every video it matches: by video title,
                          -- or "title - phase name" (same rule as production)
  SELECT ce.id, LOWER(TRIM(ce.email)) AS email, v.phase_no, v.phase_name,
         v.video_uuid, v.video_number, v.video_title,
         ce.concept_explanation_accuracy::text AS concept_explanation_accuracy,
         ce.ability_to_explain_evaluation, ce.ability_to_explain_feedback, ce.concept_explanation_feedback,
         ce.created_at
    FROM public.tbl_ailabs_ytfeedback_concept_evaluations ce
    JOIN scope s ON s.institution_id = ce.institution_id
    JOIN concept_videos v
      ON LOWER(TRIM(ce.page_name)) = LOWER(TRIM(v.video_title))
      OR LOWER(TRIM(ce.page_name)) = LOWER(TRIM(v.video_title || ' - ' || v.phase_name))
),
latest_evals AS (         -- latest evaluation per student and video
  SELECT DISTINCT ON (email, video_uuid) *
    FROM concept_matches
   WHERE created_at IS NOT NULL
   ORDER BY email, video_uuid, created_at DESC
)
SELECT email,
       phase_name,
       video_number,
       video_title,
       ability_to_explain_evaluation,
       NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE(
              (CASE WHEN ability_to_explain_feedback ~ '^\s*[{\[]' THEN ability_to_explain_feedback::jsonb END -> 'What you did well.')::text, '[]'), '[]'),
              '^"|"$', '', 'g'), '","', chr(10), 'g'), '\"', '"'), '') AS ability_to_explain_did_well,
       NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE(
              (CASE WHEN ability_to_explain_feedback ~ '^\s*[{\[]' THEN ability_to_explain_feedback::jsonb END -> 'What could you do better.')::text, '[]'), '[]'),
              '^"|"$', '', 'g'), '","', chr(10), 'g'), '\"', '"'), '') AS ability_to_explain_could_be_better,
       NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE(
              (CASE WHEN ability_to_explain_feedback ~ '^\s*[{\[]' THEN ability_to_explain_feedback::jsonb END -> 'Suggestion for improving explanation.')::text, '[]'), '[]'),
              '^"|"$', '', 'g'), '","', chr(10), 'g'), '\"', '"'), '') AS ability_to_explain_suggestion,
       CASE WHEN NULLIF(REGEXP_REPLACE(COALESCE(concept_explanation_accuracy, ''), '%', '', 'g'), '')::numeric > 80 THEN 'Yes' ELSE 'No' END AS accuracy_above_80,
       NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE(
              (CASE WHEN concept_explanation_feedback ~ '^\s*[{\[]' THEN concept_explanation_feedback::jsonb END -> 'What you did well.')::text, '[]'), '[]'),
              '^"|"$', '', 'g'), '","', chr(10), 'g'), '\"', '"'), '') AS concept_explanation_did_well,
       NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE(
              (CASE WHEN concept_explanation_feedback ~ '^\s*[{\[]' THEN concept_explanation_feedback::jsonb END -> 'What could you do better.')::text, '[]'), '[]'),
              '^"|"$', '', 'g'), '","', chr(10), 'g'), '\"', '"'), '') AS concept_explanation_could_be_better,
       NULLIF(replace(regexp_replace(regexp_replace(btrim(COALESCE(
              (CASE WHEN concept_explanation_feedback ~ '^\s*[{\[]' THEN concept_explanation_feedback::jsonb END -> 'Suggestion for technical accuracy improvement.')::text, '[]'), '[]'),
              '^"|"$', '', 'g'), '","', chr(10), 'g'), '\"', '"'), '') AS concept_explanation_suggestion,
       created_at AS evaluated_at
  FROM latest_evals
 ORDER BY email, phase_no, video_number
 LIMIT 1000     -- as production (the production view stops at 1000 rows); remove to show every student
