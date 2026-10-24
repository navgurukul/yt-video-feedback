-- ==================================================================================
-- Dashboard component: Campus Phase Timeline & Score
-- Database: TEST (test_ghar_central_db). Columns: campus_name, school_name, phase_name, student_count, avg_time_days, avg_score
-- Per campus / school / phase: students who submitted it, average days since their previous
-- phase's first submission, average phase score (YT + Project Analyzer, weighted).
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
eligible_students AS (        -- students (copied from production: tbl_ghar_*)
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
   WHERE s."Status" IN ('Active', 'Intern (In Campus)')
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
student_phase_first AS ( -- first submission per student and phase: YT project video or completed PA project
  SELECT es.campus_id, es.campus_name, es.student_name, es.email, es.student_school, x.phase_no,
         MIN(x.submitted_at) AS first_submission
    FROM eligible_students es
    JOIN (SELECT email, phase_no, created_at AS submitted_at FROM yt_project
          UNION ALL
          SELECT email, phase_no, evaluated_at FROM pa_project WHERE status = 'completed') x ON x.email = es.email
   GROUP BY es.campus_id, es.campus_name, es.student_name, es.email, es.student_school, x.phase_no
),
student_phase_gaps AS (
  SELECT f.*,
         CASE WHEN f.phase_no = 1 THEN 1
              WHEN prev.first_submission IS NULL THEN NULL
              ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM f.first_submission - prev.first_submission) / 86400))
         END AS days_taken
    FROM student_phase_first f
    LEFT JOIN student_phase_first prev ON prev.email = f.email AND prev.phase_no = f.phase_no - 1
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
campus_phase_scores AS (
  SELECT es.campus_id, es.student_school, sps.phase_no, ROUND(AVG(sps.phase_score)::numeric, 2) AS avg_score
    FROM eligible_students es
    JOIN student_phase_scores sps ON sps.email = es.email
   GROUP BY es.campus_id, es.student_school, sps.phase_no
)
SELECT g.campus_name,
       g.student_school                     AS school_name,
       CONCAT('Phase ', g.phase_no)         AS phase_name,
       COUNT(DISTINCT g.email)              AS student_count,
       ROUND(AVG(g.days_taken)::numeric, 1) AS avg_time_days,
       MAX(cs.avg_score)                    AS avg_score
  FROM student_phase_gaps g
  LEFT JOIN campus_phase_scores cs
         ON cs.campus_id = g.campus_id AND cs.student_school = g.student_school AND cs.phase_no = g.phase_no
 GROUP BY g.campus_id, g.campus_name, g.student_school, g.phase_no
 ORDER BY g.campus_name, g.student_school, g.phase_no
