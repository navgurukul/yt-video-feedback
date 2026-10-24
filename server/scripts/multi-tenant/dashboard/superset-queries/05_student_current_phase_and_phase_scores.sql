-- ==================================================================================
-- Dashboard component: Student Current Phase and Phase Scores
-- Database: TEST (test_ghar_central_db). Columns: campus_name, school_name, student_name, email, student_status, time_on_campus_days, total_present_days, write_grade, speak_grade, current_phase, expected_phase, phase1_score .. phase7_score
-- One row per student (Active, Intern in/out of campus, InActive). current_phase = last phase with a YT
-- result or a completed PA project + 1; expected_phase from days present (joining date minus leave days).
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
students AS (        -- students (copied from production: tbl_ghar_*)
  SELECT c."ID"::text                                                   AS campus_id,
         TRIM(c."Campus_Name")                                          AS campus_name,
         s."ID"::text                                                   AS student_id,
         LOWER(TRIM(s."Navgurukul_Email"))                              AS email,
         TRIM(CONCAT_WS(' ', s."Name.first_name", s."Name.last_name"))  AS student_name,
         s."Joining_Date"                                               AS joining_date,
         TRIM(s."Select_School1")                                       AS student_school,
         s."Status"                                                     AS student_status
    FROM public.tbl_ghar_add_student s
    JOIN public.tbl_ghar_create_campus c ON c."ID"::text = s."Select_Campus"::text
   WHERE s."Status" IN ('Active', 'Intern (In Campus)', 'Intern (Out Campus)', 'InActive')
     AND TRIM(s."Select_School1") IN ('School of Programming',
                 'Bachelor of Computer Applications- Eternal 24-27',
                 'Bachelor of Computer Applications- Eternal 25-28',
                 'Bachelor of Computer Applications- Eternal 26-29')
     AND s."Navgurukul_Email" IS NOT NULL
     AND TRIM(s."Navgurukul_Email") <> ''
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
last_submitted AS (       -- production: YT videos with a result, completed PA projects
  SELECT email, MAX(phase_no) AS last_phase
    FROM (SELECT email, phase_no FROM yt_project WHERE has_evaluation
          UNION ALL
          SELECT email, phase_no FROM pa_project WHERE status = 'completed') x
   GROUP BY email
),
weightages AS (           -- parameter weightages (copied from production)
  SELECT (regexp_match(phaseid::text, '(\d+)'))[1]::int AS phase_no,
         trim(regexp_replace(regexp_replace(lower(trim(parametername)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) AS norm_fullname,
         trim(regexp_replace(regexp_replace(lower(trim(COALESCE(shortparametername, parametername))), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) AS norm_shortname,
         condensedweightage
    FROM public.tbl_ailabs_phasewise_parameter_weightages
   WHERE condensedweightage IS NOT NULL
),
latest_yt_eval AS (       -- latest YT project evaluation with a result, per student and phase
  SELECT DISTINCT ON (email, phase_no) email, phase_no, evaluation_json
    FROM yt_project
   WHERE has_evaluation
   ORDER BY email, phase_no, created_at DESC
),
latest_pa_eval AS (       -- latest completed Project Analyzer evaluation, per student and phase
  SELECT DISTINCT ON (email, phase_no) email, phase_no, final_feedback
    FROM pa_project
   WHERE status = 'completed' AND final_feedback IS NOT NULL
   ORDER BY email, phase_no, evaluated_at DESC NULLS LAST
),
rubric_levels AS (        -- one row per rubric parameter of those evaluations
  SELECT 'yt' AS source, l.email, l.phase_no, prm.value ->> 'level' AS level,
         trim(regexp_replace(regexp_replace(lower(trim(prm.value ->> 'name')), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) AS norm_param
    FROM latest_yt_eval l
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(l.evaluation_json::jsonb -> 'parameters') = 'array'
           THEN l.evaluation_json::jsonb -> 'parameters' ELSE '[]'::jsonb END) prm
  UNION ALL
  SELECT 'pa', l.email, l.phase_no, c.value ->> 'assignedLevel',
         trim(regexp_replace(regexp_replace(lower(trim(c.value ->> 'parameter')), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))
    FROM latest_pa_eval l
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(l.final_feedback -> 'criterionWiseEvaluation') = 'array'
           THEN l.final_feedback -> 'criterionWiseEvaluation' ELSE '[]'::jsonb END) c
),
source_scores AS (        -- level/4 x condensed weightage, best-matching parameter name (as production)
  SELECT r.source, r.email, r.phase_no,
         ROUND(SUM(ROUND((CASE lower(trim(r.level))
                 WHEN 'beginner'     THEN (1.0/4) * w.condensedweightage
                 WHEN 'intermediate' THEN (2.0/4) * w.condensedweightage
                 WHEN 'advanced'     THEN (3.0/4) * w.condensedweightage
                 WHEN 'expert'       THEN (4.0/4) * w.condensedweightage
               END)::numeric, 2))::numeric, 2) AS score
    FROM rubric_levels r
    JOIN LATERAL (
      SELECT w.condensedweightage
        FROM weightages w
       WHERE w.phase_no = r.phase_no
         AND (w.norm_fullname = r.norm_param OR w.norm_shortname = r.norm_param
              OR r.norm_param LIKE '%' || w.norm_fullname || '%' OR w.norm_fullname LIKE '%' || r.norm_param || '%'
              OR r.norm_param LIKE '%' || w.norm_shortname || '%' OR w.norm_shortname LIKE '%' || r.norm_param || '%')
       ORDER BY (w.norm_fullname = r.norm_param)::int DESC, (w.norm_shortname = r.norm_param)::int DESC
       LIMIT 1) w ON TRUE
   WHERE lower(trim(r.level)) IN ('beginner', 'intermediate', 'advanced', 'expert')
   GROUP BY r.source, r.email, r.phase_no
),
student_phase_scores AS ( -- YT score + Project Analyzer score of the phase
  SELECT email, phase_no, ROUND(SUM(score)::numeric, 2) AS phase_score
    FROM source_scores
   GROUP BY email, phase_no
),
latest_grade AS (         -- latest English grade per student (copied from production)
  SELECT 'write' AS kind, g.*
    FROM (SELECT DISTINCT ON ("Name") "Name"::text AS student_id, "Grade" AS grade
            FROM public."tbl_ghar_Write_Improve_Data"
           ORDER BY "Name", "Completion_Date" DESC NULLS LAST) g
  UNION ALL
  SELECT 'speak', g.*
    FROM (SELECT DISTINCT ON ("Name") "Name"::text AS student_id, "Grade" AS grade
            FROM public."tbl_ghar_Speak_Improve_Data"
           ORDER BY "Name", "Completion_Date" DESC NULLS LAST) g
),
leave_days AS (           -- leave taken (copied from production)
  SELECT LOWER(TRIM(s."Navgurukul_Email")) AS email,
         SUM(COALESCE(NULLIF(TRIM(al."Days"::text), '')::numeric, 0)) AS days
    FROM public.tbl_ghar_apply_leave al
    JOIN public.tbl_ghar_add_student s ON al."Student1" = s."ID"::text
    JOIN public.tbl_ghar_leave_type lt ON al."Leave_Type" = lt."ID"::text
   WHERE s."Navgurukul_Email" IS NOT NULL AND TRIM(s."Navgurukul_Email") <> ''
     AND al."Leave_status" IS NOT NULL
   GROUP BY LOWER(TRIM(s."Navgurukul_Email"))
),
base AS (
  SELECT st.*, ls.last_phase,
         CASE WHEN st.joining_date IS NOT NULL THEN CURRENT_DATE - st.joining_date END AS time_on_campus_days,
         CASE WHEN st.joining_date IS NOT NULL
              THEN GREATEST(((CURRENT_DATE - st.joining_date) - COALESCE(ld.days, 0))::int, 0)
              ELSE 0 END AS total_present_days
    FROM students st
    LEFT JOIN last_submitted ls ON ls.email = st.email
    LEFT JOIN leave_days ld     ON ld.email = st.email
)
SELECT b.campus_name,
       b.student_school AS school_name,
       b.student_name,
       b.email,
       b.student_status,
       b.time_on_campus_days,
       b.total_present_days,
       gw.grade AS write_grade,
       gs.grade AS speak_grade,
       CASE WHEN b.last_phase IS NULL THEN 'Phase 1'
            WHEN b.last_phase >= 7    THEN 'Phase 7'
            ELSE CONCAT('Phase ', b.last_phase + 1) END AS current_phase,
       CASE WHEN b.total_present_days BETWEEN 0   AND 30  THEN 'Induction'
            WHEN b.total_present_days BETWEEN 31  AND 35  THEN 'Phase 1'
            WHEN b.total_present_days BETWEEN 36  AND 48  THEN 'Phase 2'
            WHEN b.total_present_days BETWEEN 49  AND 78  THEN 'Converting Flowcharts to JS'
            WHEN b.total_present_days BETWEEN 79  AND 108 THEN 'Phase 2.5'
            WHEN b.total_present_days BETWEEN 109 AND 128 THEN 'Phase 3'
            WHEN b.total_present_days BETWEEN 129 AND 142 THEN 'Phase 4'
            WHEN b.total_present_days BETWEEN 143 AND 157 THEN 'Phase 5'
            WHEN b.total_present_days BETWEEN 158 AND 167 THEN 'Phase 6'
            WHEN b.total_present_days BETWEEN 168 AND 212 THEN 'React'
            WHEN b.total_present_days BETWEEN 213 AND 242 THEN 'Phase 7 Final Open-ended Project'
            WHEN b.total_present_days BETWEEN 243 AND 422 THEN 'Milestone 2'
            WHEN b.total_present_days BETWEEN 423 AND 512 THEN 'Milestone 3'
            WHEN b.total_present_days BETWEEN 513 AND 602 THEN 'Milestone 4'
            ELSE 'Milestone 4++' END AS expected_phase,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 1) AS phase1_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 2) AS phase2_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 3) AS phase3_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 4) AS phase4_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 5) AS phase5_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 6) AS phase6_score,
       MAX(sps.phase_score) FILTER (WHERE sps.phase_no = 7) AS phase7_score
  FROM base b
  LEFT JOIN latest_grade gw ON gw.student_id = b.student_id AND gw.kind = 'write'
  LEFT JOIN latest_grade gs ON gs.student_id = b.student_id AND gs.kind = 'speak'
  LEFT JOIN student_phase_scores sps ON sps.email = b.email
 GROUP BY b.campus_id, b.campus_name, b.student_school, b.student_name, b.email, b.student_status, b.joining_date,
          b.time_on_campus_days, b.total_present_days, b.last_phase, gw.grade, gs.grade
 ORDER BY b.campus_name, b.student_name, b.email
