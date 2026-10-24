-- ==================================================================================
-- Dashboard component: Weekly Campus Learning
-- Database: TEST (test_ghar_central_db). Columns: week, campus_name, active_students, Total Learnings, % Learning per Active Student, Youtube Project, Youtube Concept, Project Analyzer Projects
-- Learning activities per campus per week: YT project videos with a result, YT concept videos,
-- completed Project Analyzer projects (time filter: week).
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
campus_student_counts AS (
  SELECT campus_id, campus_name, COUNT(DISTINCT email) AS active_students
    FROM eligible_students
   GROUP BY campus_id, campus_name
),
activity AS (
  SELECT es.campus_id, es.campus_name, DATE_TRUNC('week', y.created_at)::date AS week, 'yt_project' AS source
    FROM eligible_students es JOIN yt_project y ON y.email = es.email
   WHERE y.has_evaluation
  UNION ALL
  SELECT es.campus_id, es.campus_name, DATE_TRUNC('week', p.evaluated_at)::date, 'pa_project'
    FROM eligible_students es JOIN pa_project p ON p.email = es.email
   WHERE p.status = 'completed' AND p.final_feedback IS NOT NULL
  UNION ALL
  SELECT es.campus_id, es.campus_name, DATE_TRUNC('week', ce.created_at)::date, 'yt_concept'
    FROM eligible_students es
    JOIN public.tbl_ailabs_ytfeedback_concept_evaluations ce ON LOWER(TRIM(ce.email)) = es.email
    JOIN scope s ON s.institution_id = ce.institution_id
   WHERE ce.ability_to_explain_evaluation IS NOT NULL
),
weekly AS (
  SELECT a.campus_name, a.week, c.active_students,
         COUNT(*) FILTER (WHERE a.source = 'yt_project') AS yt_project,
         COUNT(*) FILTER (WHERE a.source = 'yt_concept') AS yt_concept,
         COUNT(*) FILTER (WHERE a.source = 'pa_project') AS pa_project
    FROM activity a
    JOIN campus_student_counts c ON c.campus_id = a.campus_id
   GROUP BY a.campus_name, a.week, c.active_students
)
SELECT campus_name,
       week,
       active_students,
       (yt_project + yt_concept + pa_project) AS "Total Learnings",
       ROUND((yt_project + yt_concept + pa_project)::numeric / NULLIF(active_students, 0) * 100, 2)
                                              AS "% Learning per Active Student",
       yt_project                             AS "Youtube Project",
       yt_concept                             AS "Youtube Concept",
       pa_project                             AS "Project Analyzer Projects"
  FROM weekly
 ORDER BY week DESC, "% Learning per Active Student" ASC
